/**
 * Who counts as an affected user, and who does not.
 *
 * The distinction is not a self-declaration and not a guess about who lost money. It is the
 * answer Bonzo's own claim list gives for an account: the endpoint the redemption portal
 * itself calls, `app.bonzo.finance/api/redemption/claims/<evmAddress>`, returns the Merkle
 * leaves the contract will pay. The set was derived by walking every account that could have
 * had a position — pool calls, on-behalf deposits, liquidations, aToken transfers — and
 * asking that endpoint for each one; the collector that does it is kept **out** of this
 * repository on purpose, so the repository does not hand anyone a ready-made way to
 * enumerate affected accounts. `scripts/affected-set.mjs` turns a list into
 * `content/affected.ts` without ever writing an account id into it.
 *
 * Three things the page depends on:
 *
 * 1. **The set is fixed.** Bonzo took the position snapshot on 11 July 2026 (block
 *    97 504 677, 00:51:36 UTC) and nobody can join it later, so a signer who is not in it
 *    is a supporter for good — which is what lets the page decide without asking anyone.
 * 2. **The set is complete, not sampled.** Its 7,351 leaves are the contract's `leafCount`,
 *    checked leaf by leaf; a test pins the count, so a truncated list fails the build
 *    instead of silently labelling affected users as supporters.
 * 3. **The ids are not shipped.** The file holds salted leaf hashes plus the salt, so the
 *    repository carries no readable roster of who used Bonzo. Membership is decided by
 *    hashing the connected account and looking for that hash.
 *
 * The root is the commitment, not the mechanism: the page ships the leaves (it has to — a
 * static page with no backend can only look up data it already has), and the root lets
 * anyone check that the leaves they were given are the ones this build classified by.
 */
import {
  AFFECTED_ADDITIONS,
  AFFECTED_CLAIM_LIST_COUNT,
  AFFECTED_LEAVES,
  AFFECTED_ROOT,
  AFFECTED_SALT,
} from '../content/affected'
import { config } from '../config'
import { sha256Hex, sha256Text } from './sha256'

/** How the commitment is built — stated here because it is the whole spec. */
const LEAF_PREFIX = 'bonzo-affected-user:v1\n'

/**
 * Hedera account ids are written `0.0.1234` everywhere in this project; the mirror and the
 * wallets agree on that. Trim and lowercase so a stray space or an odd casing in an older
 * message cannot turn a signer into a stranger.
 */
export function normaliseAccountId(accountId: string): string {
  return accountId.trim().toLowerCase()
}

const salt = hexToBytes(AFFECTED_SALT)

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase().replace(/^0x/, '')
  if (!/^[0-9a-f]*$/.test(clean) || clean.length % 2 !== 0) throw new Error('AFFECTED_SALT is not hex')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

/**
 * The leaf of one account: SHA-256 over the salt bytes followed by the prefix and the id.
 *
 * The salt is what keeps account numbers out of the shipped file; it is not a secret,
 * because the page needs it to answer the question at all.
 */
export function leafOf(accountId: string): string {
  const tail = new TextEncoder().encode(LEAF_PREFIX + normaliseAccountId(accountId))
  const message = new Uint8Array(salt.length + tail.length)
  message.set(salt)
  message.set(tail, salt.length)
  return sha256Hex(message)
}

const leaves = new Set(AFFECTED_LEAVES)

/** Whether this account is on the affected list — one hash and a set lookup, no network. */
export function isAffected(accountId: string | null | undefined): boolean {
  if (!accountId) return false
  return leaves.has(leafOf(accountId))
}

export type SignerStanding = 'affected' | 'supporter'

/**
 * What a signer is, for the badge. Everything not on the list is a supporter — including an
 * account we have never seen, because the list cannot grow.
 */
export function standingOf(accountId: string | null | undefined): SignerStanding {
  return isAffected(accountId) ? 'affected' : 'supporter'
}

/** How many accounts the shipped list holds. */
export const AFFECTED_COUNT = AFFECTED_LEAVES.length

/** How many of those Bonzo's claim list pays. The rest are additions, each with a reason. */
export const CLAIM_LIST_COUNT = AFFECTED_CLAIM_LIST_COUNT

/** Accounts that were affected but that the claim list does not pay, as leaves with reasons. */
export const ADDITIONS = AFFECTED_ADDITIONS

/**
 * The committed root: the GitHub repository variable when the build was given one, the
 * generated constant otherwise. Both name the same set — `scripts/check-affected-root.mjs`
 * fails the build if they ever disagree, so "the root is the variable" is enforced rather
 * than assumed.
 */
export const ROOT =
  config.affectedRoot.trim() === '' ? AFFECTED_ROOT : config.affectedRoot.trim().toLowerCase()

/** Whether the root came from configuration rather than from the generated fallback. */
export const ROOT_FROM_CONFIG = config.affectedRoot.trim() !== ''

/** One internal node: the two children sorted, concatenated as hex text, hashed. */
function nodeHash(left: string, right: string): string {
  return sha256Text(left <= right ? left + right : right + left)
}

/**
 * The Merkle root over a set of leaves.
 *
 * Leaves are sorted by hash before pairing, so the root commits to the set and not to the
 * order the list happened to arrive in. An odd node is carried up unchanged.
 */
export function merkleRoot(leafHashes: readonly string[]): string {
  if (leafHashes.length === 0) throw new Error('a Merkle root needs at least one leaf')
  let layer = [...leafHashes].sort()
  while (layer.length > 1) {
    const next: string[] = []
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!
      const right = layer[i + 1]
      next.push(right === undefined ? left : nodeHash(left, right))
    }
    layer = next
  }
  return `0x${layer[0]}`
}

/** Does the shipped set hash to the root the build was configured with? */
export function rootMatchesConfiguration(): boolean {
  return merkleRoot(AFFECTED_LEAVES) === ROOT.toLowerCase()
}

/**
 * The proof for one account: the sibling hashes from its leaf upwards.
 *
 * The page does not need it — it holds the leaves — but it is what lets a signer show that
 * their own account is under the root without handing anyone the whole set.
 */
export function merkleProof(leafHashes: readonly string[], accountId: string): string[] | null {
  const target = leafOf(accountId)
  let layer = [...leafHashes].sort()
  let position = layer.indexOf(target)
  if (position === -1) return null

  const proof: string[] = []
  while (layer.length > 1) {
    const sibling = position % 2 === 0 ? position + 1 : position - 1
    const siblingHash = layer[sibling]
    if (siblingHash !== undefined) proof.push(siblingHash)
    const next: string[] = []
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!
      const right = layer[i + 1]
      next.push(right === undefined ? left : nodeHash(left, right))
    }
    layer = next
    position = Math.floor(position / 2)
  }
  return proof
}

/**
 * Whether a proof puts `accountId` under `root` — no trust in the page, only in SHA-256.
 */
export function verifyProof(accountId: string, proof: readonly string[], root: string): boolean {
  let hash = leafOf(accountId)
  for (const sibling of proof) hash = nodeHash(hash, sibling)
  return `0x${hash}` === root.toLowerCase()
}
