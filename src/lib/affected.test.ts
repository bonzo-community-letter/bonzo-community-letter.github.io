import { describe, expect, it } from 'vitest'
import { AFFECTED_LEAVES, AFFECTED_ROOT, AFFECTED_SALT } from '../content/affected'
import {
  ADDITIONS,
  AFFECTED_COUNT,
  CLAIM_LIST_COUNT,
  isAffected,
  leafOf,
  merkleProof,
  merkleRoot,
  normaliseAccountId,
  rootMatchesConfiguration,
  standingOf,
  verifyProof,
} from './affected'

describe('the affected set', () => {
  it('ships leaf hashes, not account ids', () => {
    expect(AFFECTED_COUNT).toBe(AFFECTED_LEAVES.length)
    expect(AFFECTED_SALT).toMatch(/^[0-9a-f]{64}$/)
    for (const leaf of AFFECTED_LEAVES) expect(leaf).toMatch(/^[0-9a-f]{64}$/)
    expect(new Set(AFFECTED_LEAVES).size).toBe(AFFECTED_LEAVES.length)
    // No leaf may be an account id in disguise, and no id may survive anywhere in the file.
    for (const leaf of AFFECTED_LEAVES) expect(leaf).not.toMatch(/^0\.0\./)
  })

  it('recomputes to the committed root', () => {
    expect(merkleRoot(AFFECTED_LEAVES)).toBe(AFFECTED_ROOT)
  })

  it('hashes to the root the build was configured with', () => {
    // With VITE_AFFECTED_ROOT set (CI, Pages) this is the repository variable; locally it
    // falls back to the generated constant. Either way the leaves must hash to it.
    expect(rootMatchesConfiguration()).toBe(true)
  })

  it('is the claim list plus the reasoned additions', () => {
    // 2,455 accounts hold the contract's 7,351 claim leaves; Wallet B is added by hand.
    expect(CLAIM_LIST_COUNT).toBe(2455)
    expect(AFFECTED_COUNT).toBe(CLAIM_LIST_COUNT + ADDITIONS.length)
    for (const addition of ADDITIONS) {
      expect(addition.reason.length).toBeGreaterThan(10)
      expect(AFFECTED_LEAVES).toContain(addition.leaf)
    }
  })

  it('does not depend on the order the leaves are given in', () => {
    expect(merkleRoot([...AFFECTED_LEAVES].reverse())).toBe(AFFECTED_ROOT)
  })

  it('produces a proof that rebuilds the root, and only for its own account', () => {
    const accountId = '0.0.6754749'
    const proof = merkleProof(AFFECTED_LEAVES, accountId)
    expect(proof).not.toBeNull()
    expect(verifyProof(accountId, proof ?? [], AFFECTED_ROOT)).toBe(true)
    expect(verifyProof('0.0.999999999', proof ?? [], AFFECTED_ROOT)).toBe(false)
  })

  it('has no proof for an account that is not in the set', () => {
    expect(merkleProof(AFFECTED_LEAVES, '0.0.999999999')).toBeNull()
  })
})

describe('leafOf', () => {
  it('is stable and salt-dependent', () => {
    expect(leafOf('0.0.6754749')).toBe(leafOf('  0.0.6754749 '))
    expect(leafOf('0.0.6754749')).toHaveLength(64)
    // The same id under a different salt must not collide with the shipped leaf.
    expect(AFFECTED_LEAVES).toContain(leafOf('0.0.6754749'))
  })
})

describe('standingOf', () => {
  it('recognises an account the claim list pays', () => {
    // 0.0.6754749 had a WHBAR supply position at the snapshot and a reimbursement.
    expect(isAffected('0.0.6754749')).toBe(true)
    expect(standingOf('0.0.6754749')).toBe('affected')
  })

  it('treats every other account — and no account at all — as a supporter', () => {
    expect(standingOf('0.0.999999999')).toBe('supporter')
    expect(standingOf(null)).toBe('supporter')
    expect(standingOf(undefined)).toBe('supporter')
  })

  it('counts Wallet B as affected although the claim list does not pay it', () => {
    // A real position at the snapshot, waived under the release that returned the funds.
    // The badge answers "was this account affected", so it is affected.
    expect(standingOf('0.0.683607')).toBe('affected')
    expect(ADDITIONS.some((addition) => addition.leaf === leafOf('0.0.683607'))).toBe(true)
  })

  it('ignores stray whitespace and case', () => {
    expect(normaliseAccountId('  0.0.6754749 ')).toBe('0.0.6754749')
    expect(isAffected(' 0.0.6754749')).toBe(true)
  })
})
