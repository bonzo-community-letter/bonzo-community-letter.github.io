import {
  AGREEMENT,
  APP,
  HCS_MAX_MESSAGE_BYTES,
  MAX_COMMENT_BYTES,
  buildSignature,
  canonicalJson,
  decodeMessage,
  parseMessages,
  payloadByteLength,
  sha256Hex,
  topicMemo,
  type MirrorMessage,
  type SignaturePayload,
} from './hcs'
import { describe, expect, it } from 'vitest'

const HASH = 'a'.repeat(64)
const input = { accountId: '0.0.1234', letterId: 'bonzo-recovery-2026-11', letterHash: HASH }

const toB64 = (s: string): string => {
  const bytes = new TextEncoder().encode(s)
  return btoa(String.fromCharCode(...bytes))
}

const mirror = (payload: string, seq: number): MirrorMessage => ({
  consensus_timestamp: `${1700000000 + seq}.000000000`,
  message: toB64(payload),
  payer_account_id: '0.0.1234',
  sequence_number: seq,
})

/** fixture helper: build a payload or fail loudly */
function payloadOf(overrides: Partial<typeof input> = {}): SignaturePayload {
  const result = buildSignature({ ...input, signedAt: '2026-11-15T18:00:00.000Z', ...overrides })
  if (!result.ok) throw new Error(`fixture failed: ${result.errors.join(', ')}`)
  return result.payload
}

describe('canonicalJson', () => {
  it('sorts keys and drops undefined, so the same payload always encodes the same', () => {
    expect(canonicalJson({ b: 1, a: 2, c: undefined })).toBe('{"a":2,"b":1}')
    expect(canonicalJson({ a: 2, b: 1 })).toBe(canonicalJson({ b: 1, a: 2 }))
  })

  it('is stable for nested objects and arrays', () => {
    expect(canonicalJson({ z: [{ y: 1, x: 2 }], a: null })).toBe('{"a":null,"z":[{"x":2,"y":1}]}')
  })
})

describe('topicMemo', () => {
  it('follows the convention Bonzo used for the recovery portal', () => {
    expect(topicMemo(HASH)).toBe(`open-letter:${AGREEMENT}:v1:${HASH}`)
  })
})

describe('buildSignature', () => {
  it('builds a minimal message with the agreed field names', () => {
    const result = buildSignature({ ...input, signedAt: '2026-11-15T18:00:00.000Z' })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload).toEqual({
      app: APP,
      accountId: '0.0.1234',
      agreement: AGREEMENT,
      version: 1,
      letterId: input.letterId,
      letterHash: HASH,
      signedAt: '2026-11-15T18:00:00.000Z',
    })
    expect(result.bytes).toBeLessThan(400)
  })

  it('carries the hash of the letter, never the letter itself', () => {
    const encoded = canonicalJson(payloadOf())
    expect(encoded).toContain(HASH)
    expect(encoded).not.toContain('letterText')
  })

  it('keeps an optional comment and trims it', () => {
    const result = buildSignature({ ...input, comment: '  signed as a supplier  ' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.comment).toBe('signed as a supplier')
    expect(result.bytes).toBeLessThan(HCS_MAX_MESSAGE_BYTES)
  })

  it('omits an empty comment instead of sending a blank field', () => {
    const result = buildSignature({ ...input, comment: '   ' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.comment).toBeUndefined()
    expect(result.encoded).not.toContain('comment')
  })

  it('rejects an account id that is not a Hedera account', () => {
    for (const accountId of ['', '1234', '0.0', 'abc', '0.0.12a']) {
      expect(buildSignature({ ...input, accountId }).ok).toBe(false)
    }
  })

  it('rejects anything that is not a 64-character lowercase sha-256', () => {
    for (const letterHash of ['', 'abc', 'A'.repeat(64), 'a'.repeat(63)]) {
      expect(buildSignature({ ...input, letterHash }).ok).toBe(false)
    }
  })

  it('enforces the comment budget in bytes, not characters', () => {
    expect(buildSignature({ ...input, comment: 'a'.repeat(MAX_COMMENT_BYTES + 1) }).ok).toBe(false)

    // multi-byte characters count more than once
    expect(buildSignature({ ...input, comment: '🙂'.repeat(MAX_COMMENT_BYTES / 4 + 1) }).ok).toBe(false)

    expect(buildSignature({ ...input, comment: 'a'.repeat(MAX_COMMENT_BYTES) }).ok).toBe(true)
  })

  it('rejects control characters but allows newlines', () => {
    expect(buildSignature({ ...input, comment: 'ok\u0000bad' }).ok).toBe(false)
    expect(buildSignature({ ...input, comment: 'two\nlines' }).ok).toBe(true)
  })

  it('always fits one HCS message, even with a maximal comment', () => {
    const result = buildSignature({ ...input, comment: 'a'.repeat(MAX_COMMENT_BYTES) })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.bytes).toBeLessThanOrEqual(HCS_MAX_MESSAGE_BYTES)
    expect(payloadByteLength(result.payload)).toBe(result.bytes)
  })
})

describe('decoding', () => {
  it('round-trips a payload through base64', () => {
    const payload = payloadOf()
    expect(decodeMessage(toB64(canonicalJson(payload)))).toEqual(payload)
  })

  it('rejects other agreements, versions and foreign payloads', () => {
    const payload = payloadOf()
    expect(decodeMessage(toB64(JSON.stringify({ ...payload, agreement: 'other' })))).toBeNull()
    expect(decodeMessage(toB64(JSON.stringify({ ...payload, version: 2 })))).toBeNull()
    expect(decodeMessage(toB64(JSON.stringify({ ...payload, app: 'Bonzo Finance' })))).toBeNull()
    expect(decodeMessage(toB64('not json'))).toBeNull()
    expect(decodeMessage('!!!!')).toBeNull()
  })
})

describe('parseMessages', () => {
  const opts = { letterId: input.letterId, letterHash: HASH }

  it('keeps only signatures of this exact letter version, in consensus order', () => {
    const rows = [
      mirror(canonicalJson(payloadOf({ accountId: '0.0.2' })), 2),
      mirror(canonicalJson(payloadOf({ accountId: '0.0.1' })), 1),
      mirror(canonicalJson(payloadOf({ letterHash: 'b'.repeat(64) })), 3), // other draft
      mirror(canonicalJson(payloadOf({ letterId: 'other-letter' })), 4),
      mirror('{"hello":"world"}', 5),
      mirror('garbage', 6),
    ]
    const out = parseMessages(rows, opts)
    expect(out.map((s) => s.accountId)).toEqual(['0.0.1', '0.0.2'])
    expect(out.map((s) => s.sequence)).toEqual([1, 2])
  })

  it('carries consensus metadata and the comment through', () => {
    const built = buildSignature({ ...input, comment: 'a supplier' })
    if (!built.ok) throw new Error('fixture failed')
    const [sig] = parseMessages([mirror(built.encoded, 7)], opts)
    expect(sig?.comment).toBe('a supplier')
    expect(sig?.consensusTimestamp).toBe('1700000007.000000000')
    expect(sig?.payerAccountId).toBe('0.0.1234')
  })
})

describe('sha256Hex', () => {
  it('matches the known digest of the empty string', async () => {
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})
