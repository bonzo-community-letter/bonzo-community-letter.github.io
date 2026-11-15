import {
  HCS_MAX_MESSAGE_BYTES,
  canonicalJson,
  decodeMessage,
  encodePayload,
  parseMessages,
  payloadByteLength,
  type MirrorMessage,
  type SignaturePayload,
} from './hcs'
import { describe, expect, it } from 'vitest'

const base: SignaturePayload = {
  v: 1,
  kind: 'open-letter-signature',
  letter: 'bonzo-recovery-2026-11',
  hash: 'a'.repeat(64),
  account: '0.0.1234',
  ts: '2026-11-15T18:00:00.000Z',
}

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

describe('canonicalJson', () => {
  it('sorts keys and drops undefined, so the same payload always hashes the same', () => {
    const a = canonicalJson({ b: 1, a: 2, c: undefined })
    const b = canonicalJson({ a: 2, b: 1 })
    expect(a).toBe('{"a":2,"b":1}')
    expect(a).toBe(b)
  })

  it('is stable for nested objects and arrays', () => {
    expect(canonicalJson({ z: [{ y: 1, x: 2 }], a: null })).toBe('{"a":null,"z":[{"x":2,"y":1}]}')
  })
})

describe('payload encoding', () => {
  it('round-trips through base64', () => {
    const encoded = encodePayload(base)
    const decoded = decodeMessage(toB64(encoded))
    expect(decoded).toEqual(base)
  })

  it('fits an HCS message even with a name and role', () => {
    const full: SignaturePayload = { ...base, name: 'A'.repeat(80), role: 'affected supplier' }
    expect(payloadByteLength(full)).toBeLessThan(HCS_MAX_MESSAGE_BYTES)
  })

  it('rejects a payload of the wrong kind or version', () => {
    expect(decodeMessage(toB64(JSON.stringify({ ...base, kind: 'other' })))).toBeNull()
    expect(decodeMessage(toB64(JSON.stringify({ ...base, v: 2 })))).toBeNull()
  })

  it('rejects non-JSON and invalid base64 without throwing', () => {
    expect(decodeMessage(toB64('not json'))).toBeNull()
    expect(decodeMessage('!!!!')).toBeNull()
  })
})

describe('parseMessages', () => {
  const opts = { letter: base.letter, hash: base.hash }

  it('keeps only signatures of this exact letter version, in consensus order', () => {
    const rows = [
      mirror(encodePayload({ ...base, account: '0.0.2' }), 2),
      mirror(encodePayload({ ...base, account: '0.0.1' }), 1),
      mirror(encodePayload({ ...base, hash: 'b'.repeat(64) }), 3), // other draft
      mirror(encodePayload({ ...base, letter: 'other-letter' }), 4),
      mirror('{"hello":"world"}', 5),
      mirror('garbage', 6),
    ]
    const out = parseMessages(rows, opts)
    expect(out.map((s) => s.account)).toEqual(['0.0.1', '0.0.2'])
    expect(out.map((s) => s.sequence)).toEqual([1, 2])
  })

  it('carries consensus metadata through', () => {
    const [sig] = parseMessages([mirror(encodePayload(base), 7)], opts)
    expect(sig?.consensusTimestamp).toBe('1700000007.000000000')
    expect(sig?.payerAccountId).toBe('0.0.1234')
  })
})
