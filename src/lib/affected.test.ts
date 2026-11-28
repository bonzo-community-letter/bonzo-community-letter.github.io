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

/**
 * No test in this file may name a real account. The set ships as hashes precisely so the
 * repository holds no roster; a test asserting "0.0.x is affected" would put one back.
 * Membership is exercised through the addition's own leaf and through ids that cannot be
 * in the set.
 */
describe('the affected set', () => {
  it('ships leaf hashes, not account ids', () => {
    expect(AFFECTED_COUNT).toBe(AFFECTED_LEAVES.length)
    expect(AFFECTED_SALT).toMatch(/^[0-9a-f]{64}$/)
    for (const leaf of AFFECTED_LEAVES) expect(leaf).toMatch(/^[0-9a-f]{64}$/)
    expect(new Set(AFFECTED_LEAVES).size).toBe(AFFECTED_LEAVES.length)
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
})

describe('proofs', () => {
  // A tree of its own, so the machinery is tested without touching the real set.
  const ids = ['0.0.111', '0.0.222', '0.0.333', '0.0.444', '0.0.555']
  const leaves = ids.map(leafOf)
  const root = merkleRoot(leaves)

  it('rebuilds the root for a member, and only for its own account', () => {
    const proof = merkleProof(leaves, '0.0.222')
    expect(proof).not.toBeNull()
    expect(verifyProof('0.0.222', proof ?? [], root)).toBe(true)
    expect(verifyProof('0.0.333', proof ?? [], root)).toBe(false)
  })

  it('has no proof for an account that is not in the set', () => {
    expect(merkleProof(leaves, '0.0.999999999')).toBeNull()
  })

  it('is order-independent and survives an odd leaf count', () => {
    expect(merkleRoot([...leaves].reverse())).toBe(root)
    expect(verifyProof('0.0.555', merkleProof(leaves, '0.0.555') ?? [], root)).toBe(true)
  })
})

describe('leafOf', () => {
  it('is stable, salted and case-insensitive', () => {
    expect(leafOf('0.0.1234')).toBe(leafOf('  0.0.1234 '))
    expect(leafOf('0.0.1234')).toHaveLength(64)
    expect(leafOf('0.0.1234')).not.toBe(leafOf('0.0.1235'))
  })
})

describe('standingOf', () => {
  it('treats an account that cannot be in the set as a supporter', () => {
    expect(isAffected('0.0.999999999')).toBe(false)
    expect(standingOf('0.0.999999999')).toBe('supporter')
  })

  it('treats no account at all as a supporter', () => {
    expect(standingOf(null)).toBe('supporter')
    expect(standingOf(undefined)).toBe('supporter')
  })

  it('recognises every addition by its leaf', () => {
    // Hand-added accounts: real positions the claim list does not pay — Wallet B (waived claim)
    // and the nine accounts the claim contract cannot pay because they cannot sign. Their ids
    // are not in this file — the leaf is what ships, and the leaf is what the set contains.
    expect(ADDITIONS.length).toBeGreaterThan(0)
    for (const addition of ADDITIONS) {
      expect(AFFECTED_LEAVES).toContain(addition.leaf)
      expect(addition.reason.trim().length).toBeGreaterThanOrEqual(10)
    }
  })

  it('ignores stray whitespace and case', () => {
    expect(normaliseAccountId('  0.0.1234 ')).toBe('0.0.1234')
  })
})
