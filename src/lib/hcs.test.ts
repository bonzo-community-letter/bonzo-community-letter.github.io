import {
  HCS_MAX_MESSAGE_BYTES,
  MAX_COMMENT_BYTES,
  buildSignature,
  decodeMessage,
  encodePayload,
  hashscanTransactionUrl,
  parseMessages,
  payloadByteLength,
  sha256Hex,
  signeeNumbers,
  testimonials,
  type MirrorMessage,
  type SignaturePayload,
} from './hcs'
import { describe, expect, it } from 'vitest'

const HASH = 'a'.repeat(64)
const LETTER = 'bonzo-exploit-open-letter'
const input = { subject: LETTER, letterHash: HASH }

/** A signature as the mirror hands it over, with only the fields the numbering reads. */
const base = {
  subject: LETTER,
  letterHash: HASH,
  version: 2,
  comment: '',
  recoveryRate: null,
  payerAccountId: '0.0.1234',
  consensusTimestamp: '0.0',
  accountId: '0.0.1',
  signedAt: '2026-11-15T10:00:00.000Z',
  sequence: 1,
} as const

const toB64 = (s: string): string => {
  const bytes = new TextEncoder().encode(s)
  return btoa(String.fromCharCode(...bytes))
}

const mirror = (payload: string, seq: number, payer = '0.0.1234'): MirrorMessage => ({
  consensus_timestamp: `${1700000000 + seq}.000000000`,
  message: toB64(payload),
  payer_account_id: payer,
  sequence_number: seq,
})

/** fixture helper: build a payload or fail loudly */
function payloadOf(overrides: Partial<typeof input> = {}): SignaturePayload {
  const result = buildSignature({ ...input, signedAt: '2026-11-15T18:00:00.000Z', ...overrides })
  if (!result.ok) throw new Error(`fixture failed: ${result.errors.join(', ')}`)
  return result.payload
}

describe('recoveryRate', () => {
  it('carries a rate the signer gave', () => {
    const result = buildSignature({ ...input, recoveryRate: 8.8 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.recoveryRate).toBe(8.8)
    expect(encodePayload(result.payload)).toContain('"recoveryRate":8.8')
  })

  it('rounds to one decimal, because finer is noise', () => {
    const result = buildSignature({ ...input, recoveryRate: 8.8333 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.recoveryRate).toBe(8.8)
  })

  it('accepts the two ends of the scale', () => {
    for (const rate of [0, 100]) {
      const result = buildSignature({ ...input, recoveryRate: rate })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.payload.recoveryRate).toBe(rate)
    }
  })

  it('refuses a rate outside 0–100, or one that is not a number', () => {
    for (const rate of [-0.1, 100.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = buildSignature({ ...input, recoveryRate: rate })
      expect(result.ok).toBe(false)
    }
  })

  it('stores silence as null, not as a zero', () => {
    for (const value of [undefined, null]) {
      const result = buildSignature({ ...input, recoveryRate: value })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.payload.recoveryRate).toBeNull()
    }
  })

  it('still reads a message written before the field existed', () => {
    const old = JSON.stringify({
      subject: LETTER,
      version: 2,
      letterHash: HASH,
      signedAt: '2026-11-15T18:00:00.000Z',
      comment: 'Test',
    })
    const decoded = decodeMessage(btoa(old))
    expect(decoded).not.toBeNull()
    expect(decoded?.comment).toBe('Test')
    expect(decoded?.recoveryRate).toBeUndefined()
  })
})

describe('encodePayload', () => {
  it('serialises fields in the documented order, compactly', () => {
    const payload = payloadOf()
    expect(encodePayload(payload)).toBe(
      `{"subject":"${LETTER}","version":2,"letterHash":"${HASH}",` +
        `"signedAt":"2026-11-15T18:00:00.000Z","comment":"","recoveryRate":null}`,
    )
  })

  it('produces identical bytes for identical values', () => {
    expect(encodePayload(payloadOf())).toBe(encodePayload(payloadOf()))
  })
})

describe('buildSignature', () => {
  it('builds exactly the fields we need and nothing else', () => {
    const result = buildSignature({ ...input, signedAt: '2026-11-15T18:00:00.000Z' })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload).toEqual({
      subject: LETTER,
      letterHash: HASH,
      signedAt: '2026-11-15T18:00:00.000Z',
      version: 2,
      comment: '',
      recoveryRate: null,
    })
    expect(Object.keys(result.payload).sort()).toEqual(
      ['subject', 'letterHash', 'signedAt', 'version', 'comment', 'recoveryRate'].sort(),
    )
  })

  it('never puts an account id in the message', () => {
    const result = buildSignature({ ...input, signedAt: '2026-11-15T18:00:00.000Z' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload).not.toHaveProperty('accountId')
    expect(result.encoded).not.toContain('accountId')
    expect(result.encoded).not.toContain('0.0.')
  })

  it('carries the hash of the letter, never the letter itself', () => {
    const encoded = encodePayload(payloadOf())
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

  it('always carries a comment field, empty when the signer wrote none', () => {
    const result = buildSignature({ ...input, comment: '   ' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.comment).toBe('')
    expect(result.encoded).toContain('"comment":""')
  })

  it('rejects anything that is not a 64-character lowercase sha-256', () => {
    for (const letterHash of ['', 'abc', 'A'.repeat(64), 'a'.repeat(63)]) {
      expect(buildSignature({ ...input, letterHash }).ok).toBe(false)
    }
  })

  it('rejects a subject that is empty or malformed', () => {
    for (const subject of ['', 'Bonzo Letter', 'BONZO', 'bonzo_letter', '-leading']) {
      expect(buildSignature({ ...input, subject }).ok).toBe(false)
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
    expect(decodeMessage(toB64(encodePayload(payload)))).toEqual(payload)
  })

  it('rejects other versions and foreign payloads', () => {
    const payload = payloadOf()
    expect(decodeMessage(toB64(JSON.stringify({ ...payload, version: 1 })))).toBeNull()
    expect(decodeMessage(toB64(JSON.stringify({ ...payload, version: 3 })))).toBeNull()
    expect(decodeMessage(toB64(JSON.stringify({ hello: 'world' })))).toBeNull()
    expect(decodeMessage(toB64('not json'))).toBeNull()
    expect(decodeMessage('!!!!')).toBeNull()
  })

  it('ignores a version 1 message, whose signer was a claim inside the JSON', () => {
    const v1 = JSON.stringify({
      accountId: '0.0.1234',
      subject: LETTER,
      version: 1,
      letterHash: HASH,
      signedAt: '2026-11-15T18:00:00.000Z',
      comment: 'Test',
    })
    expect(decodeMessage(toB64(v1))).toBeNull()
  })
})

describe('parseMessages', () => {
  const opts = { subject: LETTER, letterHash: HASH }

  it('keeps only signatures of this exact letter version, in consensus order', () => {
    const rows = [
      mirror(encodePayload(payloadOf()), 2, '0.0.2'),
      mirror(encodePayload(payloadOf()), 1, '0.0.1'),
      mirror(encodePayload(payloadOf({ letterHash: 'b'.repeat(64) })), 3), // other draft
      mirror(encodePayload(payloadOf({ subject: 'other-letter' })), 4),
      mirror('{"hello":"world"}', 5),
      mirror('garbage', 6),
    ]
    const out = parseMessages(rows, opts)
    expect(out.map((s) => s.accountId)).toEqual(['0.0.1', '0.0.2'])
    expect(out.map((s) => s.sequence)).toEqual([1, 2])
  })

  it('takes the signer from the payer, not from anything the message says', () => {
    // A message that names another account, posted and paid for by the attacker.
    const forged = JSON.stringify({ ...payloadOf(), accountId: '0.0.10248067' })
    const [sig] = parseMessages([mirror(forged, 9, '0.0.99999999')], opts)
    expect(sig?.accountId).toBe('0.0.99999999')
    expect(sig?.payerAccountId).toBe('0.0.99999999')
  })

  it('drops a message the mirror gives no payer for', () => {
    const built = buildSignature(input)
    if (!built.ok) throw new Error('fixture failed')
    const row = { ...mirror(built.encoded, 3), payer_account_id: undefined }
    expect(parseMessages([row], opts)).toHaveLength(0)
    expect(parseMessages([mirror(built.encoded, 4, 'not-an-account')], opts)).toHaveLength(0)
  })

  it('carries consensus metadata and the comment through', () => {
    const built = buildSignature({ ...input, comment: 'a supplier' })
    if (!built.ok) throw new Error('fixture failed')
    const [sig] = parseMessages([mirror(built.encoded, 7)], opts)
    expect(sig?.comment).toBe('a supplier')
    expect(sig?.consensusTimestamp).toBe('1700000007.000000000')
    expect(sig?.accountId).toBe('0.0.1234')
    expect(sig?.payerAccountId).toBe('0.0.1234')
  })
})

describe('hashscanTransactionUrl', () => {
  it('rewrites the wallet form into the explorer form', () => {
    expect(hashscanTransactionUrl('mainnet', '0.0.1234@1700000000.123456789')).toBe(
      'https://hashscan.io/mainnet/transaction/0.0.1234-1700000000-123456789',
    )
  })

  it('leaves an already-normalised id alone', () => {
    expect(hashscanTransactionUrl('testnet', '0.0.1234-1700000000-123456789')).toBe(
      'https://hashscan.io/testnet/transaction/0.0.1234-1700000000-123456789',
    )
  })
})

describe('sha256Hex', () => {
  it('matches the known digest of the empty string', async () => {
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})

describe('signeeNumbers', () => {
  const at = (iso: string, accountId: string) => ({
    ...base,
    accountId,
    signedAt: iso,
    sequence: 0,
  })

  it('numbers signers by the order they signed, not by the order they arrived', () => {
    const numbers = signeeNumbers([
      at('2026-11-20T10:00:00.000Z', '0.0.3'),
      at('2026-11-15T10:00:00.000Z', '0.0.1'),
      at('2026-11-18T10:00:00.000Z', '0.0.2'),
    ])
    expect(numbers.get('0.0.1')).toBe(1)
    expect(numbers.get('0.0.2')).toBe(2)
    expect(numbers.get('0.0.3')).toBe(3)
  })

  it('counts every signer, including the ones who wrote nothing', () => {
    const [entry] = testimonials([
      at('2026-11-15T10:00:00.000Z', '0.0.1'),
      { ...at('2026-11-16T10:00:00.000Z', '0.0.2'), comment: 'hello' },
    ])
    // the silent signer is #1, so the one who wrote is #2 — not #1
    expect(entry?.signeeNumber).toBe(2)
  })

  it('breaks a tie on the topic sequence', () => {
    const same = '2026-11-15T10:00:00.000Z'
    const numbers = signeeNumbers([
      { ...at(same, '0.0.9'), sequence: 7 },
      { ...at(same, '0.0.8'), sequence: 3 },
    ])
    expect(numbers.get('0.0.8')).toBe(1)
    expect(numbers.get('0.0.9')).toBe(2)
  })

  it('counts an account once, however many times it signed', () => {
    const numbers = signeeNumbers([
      at('2026-11-15T10:00:00.000Z', '0.0.1'),
      at('2026-11-16T10:00:00.000Z', '0.0.1'),
      at('2026-11-17T10:00:00.000Z', '0.0.2'),
    ])
    expect(numbers.size).toBe(2)
    expect(numbers.get('0.0.2')).toBe(2)
  })
})
