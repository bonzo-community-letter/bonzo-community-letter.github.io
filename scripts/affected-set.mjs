#!/usr/bin/env node
/**
 * Turn the affected-account list into `src/content/affected.ts` — as salted leaf hashes.
 *
 *   node scripts/affected-set.mjs <list.json>
 *
 * The input is either a plain array of account ids, or
 * `{ "claimList": [...], "additions": [...] }`. `additions` are accounts that were affected
 * but that Bonzo's claim list does not pay; they are kept apart with a stated reason,
 * because the two mean different things:
 *
 *   claim list  — Bonzo pays this account; its leaves are in the contract's tree
 *   addition    — this account was affected, but the tree does not pay it
 *
 * **No account id leaves this script.** The shipped file carries salted leaf hashes and the
 * salt, never the ids, so the repository does not contain a readable roster of who used
 * Bonzo. The salt makes the file grep-proof and stops a casual reader from reading off
 * account numbers; it does not make membership unguessable, because the salt ships with the
 * page — anyone willing to hash 2,456 candidates can still test an id. Against that, only a
 * server would help, and a static site has none.
 *
 * Leaf  = SHA-256(salt ‖ "bonzo-affected-user:v1\n" ‖ accountId)
 * Node  = SHA-256(sorted(left, right) as hex text)
 * Root  = the last node; leaves sorted by hash before pairing, so the root commits to the
 *         set and not to the order it arrived in.
 *
 * The salt is read from `scripts/affected-salt.txt` and created once if missing: a salt that
 * changed on every regeneration would change the root and make the GitHub variable useless.
 */
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const LEAF_PREFIX = 'bonzo-affected-user:v1\n'
const here = dirname(fileURLToPath(import.meta.url))
const target = join(here, '..', 'src', 'content', 'affected.ts')
const saltPath = join(here, 'affected-salt.txt')

const sha256Text = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

/**
 * The salt, in bytes — created once, then reused, so the root stays stable.
 *
 * Order matters: the local file first (that is the source of truth for a rebuild), then the
 * salt already written into `src/content/affected.ts` (so a fresh checkout without the local
 * file still reproduces the same root instead of inventing a new one), then a new salt.
 */
function saltBytes() {
  if (existsSync(saltPath)) {
    const hex = readFileSync(saltPath, 'utf8').trim()
    if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error(`${saltPath} must hold 32 bytes as 64 hex characters`)
    return Buffer.from(hex, 'hex')
  }
  if (existsSync(target)) {
    const match = /AFFECTED_SALT = '([0-9a-f]{64})'/.exec(readFileSync(target, 'utf8'))
    if (match) return Buffer.from(match[1], 'hex')
  }
  const fresh = randomBytes(32).toString('hex')
  writeFileSync(saltPath, `${fresh}\n`, 'utf8')
  console.error(`created ${saltPath} (keep it locally: the salt ships inside affected.ts)`)
  return Buffer.from(fresh, 'hex')
}

const salt = saltBytes()
const saltHex = salt.toString('hex')

/** The leaf of one account: salt bytes, then the prefix and the id, as one message. */
const leafOf = (accountId) =>
  createHash('sha256').update(Buffer.concat([salt, Buffer.from(LEAF_PREFIX + accountId, 'utf8')])).digest('hex')

function accountNumber(id) {
  const match = /^0\.0\.(\d+)$/.exec(id)
  if (!match) throw new Error(`not a Hedera account id: ${JSON.stringify(id)}`)
  return Number(match[1])
}

function merkleRoot(leaves) {
  let layer = [...leaves].sort()
  while (layer.length > 1) {
    const next = []
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]
      const right = layer[i + 1]
      next.push(right === undefined ? left : sha256Text([left, right].sort().join('')))
    }
    layer = next
  }
  return `0x${layer[0]}`
}

const input = process.argv[2]
if (!input) {
  console.error('usage: node scripts/affected-set.mjs <list.json>')
  process.exit(1)
}

const raw = JSON.parse(readFileSync(resolve(input), 'utf8'))
const claimList = Array.isArray(raw) ? raw : (raw.claimList ?? raw.affected)
// Additions live next to this script, not in the collected file: the collector derives who
// Bonzo pays, and "affected but not paid" is a judgement that belongs in a diff, with a
// reason attached — never something a re-run can silently drop.
// Additions come from the input file, never from a file in the repository: who counts as
// affected-but-unpaid is a judgement with a reason attached, and the ids stay local.
const additionsSource = Array.isArray(raw) ? [] : (raw.additions ?? [])
const additions = additionsSource.map((entry) => {
  const accountId = String(entry.accountId ?? entry.id ?? '').trim().toLowerCase()
  const reason = String(entry.reason ?? '').trim()
  if (!/^0\.0\.\d+$/.test(accountId)) {
    throw new Error(`addition without a valid account id: ${JSON.stringify(entry)}`)
  }
  if (reason.length < 10) {
    throw new Error(`addition ${accountId} needs a reason — an unexplained account in the set is not auditable`)
  }
  return { accountId, reason, leaf: leafOf(accountId) }
})

if (!Array.isArray(claimList) || claimList.length === 0) {
  console.error('the claim list is empty or has no `claimList`/`affected` array — refusing to write a set of zero users')
  process.exit(1)
}

const normalised = claimList.map((id) => String(id).trim().toLowerCase())
const unique = [...new Set(normalised)]
if (unique.length !== normalised.length) {
  console.error(`the claim list repeats ${normalised.length - unique.length} account id(s) — dedupe before generating`)
  process.exit(1)
}

const claimCount = unique.length
const ids = [...new Set([...unique, ...additions.map((a) => a.accountId)])].sort((a, b) => accountNumber(a) - accountNumber(b))
const leaves = ids.map(leafOf)
const root = merkleRoot(leaves)
const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

const leafBody = [...leaves].sort().map((leaf) => `  '${leaf}',`).join('\n')
const additionRows = additions
  .map((a) => `  { leaf: '${a.leaf}', reason: ${JSON.stringify(a.reason)} },`)
  .join('\n')

const file = `/**
 * Generated by scripts/affected-set.mjs — do not edit by hand.
 *
 * Every Hedera account this letter counts as an affected user, as **salted leaf hashes**:
 * no account id is in this file. The leaves are SHA-256(salt ‖ "bonzo-affected-user:v1\\n" ‖
 * accountId) with the salt below, so the repository holds no readable roster of who used
 * Bonzo — a casual reader, a search engine or a diff cannot turn a hash back into an id.
 *
 * It does not make membership unguessable: the salt ships with the page, so anyone willing
 * to hash candidates can still test an account id. That is the price of a static site with
 * no backend, and Bonzo's own portal already answers the same question per id.
 *
 * Two parts, kept apart on purpose:
 *
 * - the **claim list**: the accounts Bonzo's redemption contract pays. Their leaves are the
 *   contract's 7,351-leaf Merkle tree, read from the same public endpoint the portal calls.
 *   \`AFFECTED_CLAIM_LIST_COUNT\` is that list's size.
 * - the **additions**: accounts that were affected but that the tree does not pay, each with
 *   its reason. Two kinds today: Wallet B, the white-hat responder (a real position, a waived
 *   claim), and the nine accounts the claim contract cannot pay because they cannot sign —
 *   six smart contracts, two multisigs and one keyless system account, whose allocations are
 *   held in the Foundation's reserve at 0.0.10901569 and settled manually.
 *
 * The root commits to both together — the badge answers "was this account affected", not
 * "will Bonzo pay this account". Snapshot: block 97,504,677 — 2026-07-11 00:51:36 UTC.
 * The set is closed: no account can join it later, which is what lets the page call
 * everyone else a supporter without asking.
 */
export const AFFECTED_GENERATED_AT = '${generatedAt}'
export const AFFECTED_SOURCE = 'app.bonzo.finance/api/redemption/claims/<evmAddress>'
export const AFFECTED_SALT = '${saltHex}'
export const AFFECTED_ROOT = '${root}'
export const AFFECTED_CLAIM_LIST_COUNT = ${claimCount}
export const AFFECTED_ADDITIONS: readonly { leaf: string; reason: string }[] = [
${additionRows}
]
export const AFFECTED_LEAVES: readonly string[] = [
${leafBody}
]
`

writeFileSync(target, file, 'utf8')
console.log(`claim list ${claimCount}, additions ${additions.length}, leaves ${leaves.length}`)
console.log(`root ${root}`)
console.log(`file ${target}`)
