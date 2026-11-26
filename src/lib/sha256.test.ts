import { describe, expect, it } from 'vitest'
import { sha256Hex, sha256Text } from './sha256'

/** The platform implementation, as the reference. */
async function reference(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('sha256', () => {
  it('matches the published vectors', () => {
    expect(sha256Text('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Text('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256Text('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    )
  })

  it('agrees with crypto.subtle across block boundaries', async () => {
    // 55, 56, 63, 64 and 65 bytes are where padding changes shape — the cases a hand-written
    // SHA-256 gets wrong.
    for (const length of [0, 1, 55, 56, 63, 64, 65, 119, 120, 128, 1000]) {
      const text = 'a'.repeat(length)
      expect(sha256Text(text)).toBe(await reference(text))
    }
  })

  it('agrees with crypto.subtle on binary input', async () => {
    const bytes = new Uint8Array(200)
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37) % 256
    const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)
    const expected = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
    expect(sha256Hex(bytes)).toBe(expected)
  })
})
