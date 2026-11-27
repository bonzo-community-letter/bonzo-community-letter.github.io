import { describe, expect, it } from 'vitest'
import { sampleSignatures } from './demo'

/**
 * The samples stand in for real signers in the demo reel and in read-only mode. A rate below
 * the published floor would put a number on the page that the recovery does not support —
 * the portal pays 56.1 % to 100 %, and a sample must not invent a worse outcome than the real
 * one. Silence (null) is allowed: a signer who did not state a rate is real too.
 */
describe('sample comments', () => {
  const entries = sampleSignatures('bonzo-exploit-open-letter', 'a'.repeat(64))

  it('has entries to show', () => {
    expect(entries.length).toBeGreaterThan(5)
  })

  it('keeps every comment inside what the field accepts, so the layout is tested', () => {
    for (const entry of entries) {
      const bytes = new TextEncoder().encode(entry.comment ?? '').length
      expect(bytes, entry.accountId).toBeGreaterThanOrEqual(77)
      expect(bytes, entry.accountId).toBeLessThanOrEqual(512)
    }
  })

  it('puts at least half of the accounts at the published floor', () => {
    // The floor is where most real accounts sit: 56.1 % is what an account that supplied only
    // HBAR or USDC received. A reel where the floor is the exception would misrepresent it.
    const atFloor = entries.filter((entry) => entry.recoveryRate === 56.1).length
    expect(atFloor / entries.length).toBeGreaterThanOrEqual(0.5)
  })

  it('never shows a recovery rate below the published floor', () => {
    for (const entry of entries) {
      if (entry.recoveryRate === null) continue
      expect(entry.recoveryRate, entry.accountId).toBeGreaterThanOrEqual(56.1)
      expect(entry.recoveryRate, entry.accountId).toBeLessThanOrEqual(100)
    }
  })
})
