export const PAYLOAD_VERSION = 2 as const

export type HederaNetwork = 'mainnet' | 'testnet'

export const HCS_MAX_MESSAGE_BYTES = 1024
/**
 * Policy cap on the optional comment. Well below what HCS allows so the whole
 * payload always fits with headroom, whatever the account id and timestamp cost.
 */
export const MAX_COMMENT_BYTES = 512

/**
 * The message a signer submits.
 *
 * It carries the *hash* of the letter, not the letter itself — the same
 * primitive Bonzo used for the recovery portal's termsHash, and small enough to
 * stay far under HCS's 1 KB cap. `letter` names the campaign; `letterHash` pins
 * the exact version of the text.
 *
 * It deliberately carries **no account id**. Who signed is the one fact the
 * message cannot be trusted about: the topic has no submit key, so anyone can
 * post a message claiming any id. The network, by contrast, will not accept a
 * topic message from an account that did not sign and pay for it — so the
 * signer is read from `payer_account_id` on the mirror's envelope and never from
 * the JSON inside it. See `parseMessages`.
 */
export interface SignaturePayload {
  /** campaign subject, e.g. "bonzo-exploit-open-letter" */
  subject: string
  /** SHA-256 of the letter text, lowercase hex — computed at build time */
  letterHash: string
  /** ISO-8601 UTC timestamp, set by the client */
  signedAt: string
  /** payload schema version */
  version: number
  /** signer-authored, permanent and public; empty string when the signer wrote none */
  comment: string
  /**
   * Share of the signer's loss that has been recovered, in percent (0–100, one decimal),
   * or null when the signer did not say. Part of the message, so it is on the record with
   * the signature and cannot be corrected afterwards — which is the point.
   */
  recoveryRate: number | null
}

export interface Signature extends SignaturePayload {
  /**
   * The signer, taken from the transaction's payer — the account the network
   * charged and required a signature from. Not a claim made inside the message.
   */
  accountId: string
  sequence: number
  consensusTimestamp: string
  /** Same value as `accountId`; kept because the mirror calls it the payer. */
  payerAccountId: string
}

export interface MirrorMessage {
  consensus_timestamp: string
  message: string
  payer_account_id?: string
  sequence_number: number
}

export interface SignatureInput {
  subject: string
  letterHash: string
  comment?: string
  /** percent recovered, 0–100; absent or null when the signer did not say */
  recoveryRate?: number | null
  /** injectable for tests; defaults to now */
  signedAt?: string
}

export type BuildResult =
  | { ok: true; payload: SignaturePayload; encoded: string; bytes: number }
  | { ok: false; errors: string[] }

export const MIRROR_BASE: Record<HederaNetwork, string> = {
  mainnet: 'https://mainnet-public.mirrornode.hedera.com/api/v1',
  testnet: 'https://testnet.mirrornode.hedera.com/api/v1',
}

/** Block explorer, per network — the same switch as the mirror node. */
export const HASHSCAN_BASE: Record<HederaNetwork, string> = {
  mainnet: 'https://hashscan.io/mainnet',
  testnet: 'https://hashscan.io/testnet',
}

export const MAX_RECOVERY_RATE = 100
const ACCOUNT_ID = /^\d+\.\d+\.\d+$/
const SHA256_HEX = /^[a-f0-9]{64}$/
const SLUG = /^[a-z0-9][a-z0-9-]*$/

const byteLength = (s: string): number => new TextEncoder().encode(s).length

/**
 * The exact field order a signature message is serialised in:
 * `subject`, `version`, `letterHash`, `signedAt`, `comment`, `recoveryRate`.
 *
 * A fixed order — rather than sorted keys — is what makes the bytes
 * reproducible: every client emits the same string for the same values.
 *
 * Version 2 dropped `accountId`: the signer is the transaction's payer, read
 * from the mirror envelope, and a message that names an account is a message
 * that can lie about it. Version 1 messages are therefore not read at all.
 */
export const FIELD_ORDER = [
  'subject',
  'version',
  'letterHash',
  'signedAt',
  'comment',
  // appended, never inserted: messages written before this field existed must still
  // decode, and a reader can tell them apart by its absence
  'recoveryRate',
] as const

export function encodePayload(payload: SignaturePayload): string {
  const body = FIELD_ORDER.map((key) => `${JSON.stringify(key)}:${JSON.stringify(payload[key])}`).join(',')
  return `{${body}}`
}

export function payloadByteLength(payload: SignaturePayload): number {
  return byteLength(encodePayload(payload))
}

/** The same message as `encodePayload`, laid out for reading on a page. */
export function prettyPayload(payload: SignaturePayload): string {
  const ordered: Record<string, string | number | null> = {}
  for (const key of FIELD_ORDER) ordered[key] = payload[key]
  return JSON.stringify(ordered, null, 2)
}

export function commentByteLength(comment: string): number {
  return byteLength(comment)
}

/**
 * Build the exact message a signer will submit, or explain why it cannot be
 * submitted. Everything that can be checked before a wallet is involved is
 * checked here, so the UI never asks for a signature that would fail.
 */
export function buildSignature(input: SignatureInput): BuildResult {
  const errors: string[] = []

  if (!SLUG.test(input.subject)) errors.push('subject must be a lowercase slug')
  if (!SHA256_HEX.test(input.letterHash)) errors.push('letterHash must be 64 lowercase hex characters')

  let comment: string | undefined
  if (typeof input.comment === 'string') {
    const trimmed = input.comment.trim()
    if (trimmed.length > 0) {
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(trimmed)) {
        errors.push('comment contains control characters')
      }
      if (commentByteLength(trimmed) > MAX_COMMENT_BYTES) {
        errors.push(`comment is longer than ${MAX_COMMENT_BYTES} bytes`)
      }
      comment = trimmed
    }
  }

  let recoveryRate: number | null = null
  if (input.recoveryRate !== undefined && input.recoveryRate !== null) {
    const rate = input.recoveryRate
    if (typeof rate !== 'number' || !Number.isFinite(rate)) {
      errors.push('recoveryRate must be a number between 0 and 100')
    } else if (rate < 0 || rate > MAX_RECOVERY_RATE) {
      errors.push(`recoveryRate must be between 0 and ${MAX_RECOVERY_RATE}`)
    } else {
      // one decimal is as much precision as anyone has; anything finer is noise
      recoveryRate = Math.round(rate * 10) / 10
    }
  }

  if (errors.length > 0) return { ok: false, errors }

  const payload: SignaturePayload = {
    subject: input.subject,
    letterHash: input.letterHash,
    signedAt: input.signedAt ?? new Date().toISOString(),
    version: PAYLOAD_VERSION,
    comment: comment ?? '',
    recoveryRate,
  }

  const encoded = encodePayload(payload)
  const bytes = byteLength(encoded)
  if (bytes > HCS_MAX_MESSAGE_BYTES) {
    return {
      ok: false,
      errors: [`message would be ${bytes} bytes; HCS allows ${HCS_MAX_MESSAGE_BYTES}`],
    }
  }

  return { ok: true, payload, encoded, bytes }
}

function isSignaturePayload(value: unknown): value is SignaturePayload {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  return (
    p.version === PAYLOAD_VERSION &&
    typeof p.subject === 'string' &&
    typeof p.letterHash === 'string' &&
    typeof p.signedAt === 'string' &&
    (p.comment === undefined || typeof p.comment === 'string') &&
    (p.recoveryRate === undefined ||
      p.recoveryRate === null ||
      (typeof p.recoveryRate === 'number' && Number.isFinite(p.recoveryRate)))
  )
}

/** Decode one mirror-node message body; returns null for anything that is not ours. */
export function decodeMessage(base64: string): SignaturePayload | null {
  try {
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    const parsed: unknown = JSON.parse(text)
    return isSignaturePayload(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Keep only messages that are signatures of *this* letter version.
 * Anything else on the topic (older drafts, other campaigns, junk) is ignored.
 *
 * **Who signed comes from the envelope, never from the message.** The topic has
 * no submit key, so anyone can post JSON claiming any account id; what nobody
 * can do is post a topic message without the claimed account signing and paying
 * for it. `payer_account_id` is that account — the mirror's own record of the
 * transaction's payer — so it is the only field here that a stranger cannot
 * choose. A message with no valid payer is not a signature and is dropped.
 */
export function parseMessages(
  messages: readonly MirrorMessage[],
  opts: { subject: string; letterHash: string },
): Signature[] {
  const out: Signature[] = []
  for (const m of messages) {
    const accountId = (m.payer_account_id ?? '').trim().toLowerCase()
    if (!ACCOUNT_ID.test(accountId)) continue
    const payload = decodeMessage(m.message)
    if (!payload) continue
    if (payload.subject !== opts.subject) continue
    if (payload.letterHash !== opts.letterHash) continue
    out.push({
      ...payload,
      accountId,
      comment: payload.comment ?? '',
      sequence: m.sequence_number,
      consensusTimestamp: m.consensus_timestamp,
      payerAccountId: accountId,
    })
  }
  return out.sort((a, b) => Number(a.consensusTimestamp) - Number(b.consensusTimestamp))
}

/** Independent re-implementation of the build-time hash, for verification UI/tests. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * One signature per account, for counting.
 *
 * The chain cannot refuse a second message from the same wallet — a topic is append-only
 * and the payload carries no nonce — so the reader dedupes: the first signature an
 * account made is the one that counts, and a repeat stays on the topic as what it is.
 */
export function uniqueSigners(signatures: readonly Signature[]): Signature[] {
  const seen = new Set<string>()
  const kept: Signature[] = []
  for (const signature of signatures) {
    const account = signature.accountId.trim().toLowerCase()
    if (seen.has(account)) continue
    seen.add(account)
    kept.push(signature)
  }
  return kept
}

export interface Testimonial {
  accountId: string
  comment: string
  signedAt: string
  /** percent recovered, or null when the signer did not say */
  recoveryRate: number | null
  /** position among all signers, 1 for the earliest signature of this letter */
  signeeNumber: number
}

/**
 * Who signed first.
 *
 * A signer's number is their place in the order the signatures were made, counted over
 * every account that signed this letter version — not over the ones that left a comment,
 * so a number means the same thing here as it does in the count. Ties fall back to the
 * topic sequence, which is the order the network itself saw.
 */
export function signeeNumbers(signatures: readonly Signature[]): Map<string, number> {
  const ordered = uniqueSigners(signatures).sort((a, b) => {
    const at = Date.parse(a.signedAt)
    const bt = Date.parse(b.signedAt)
    if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt
    return (a.sequence ?? 0) - (b.sequence ?? 0)
  })

  const numbers = new Map<string, number>()
  ordered.forEach((signature, index) => {
    numbers.set(signature.accountId.trim().toLowerCase(), index + 1)
  })
  return numbers
}

/**
 * What each account said, once.
 *
 * The first signature an account made is the one that counts — the same rule the count
 * follows — and an account that wrote nothing has nothing to show. Comments are trimmed
 * by `buildSignature` before they are submitted; trimming again costs nothing and keeps
 * a hand-edited message from carrying stray whitespace onto the page.
 */
export function testimonials(signatures: readonly Signature[]): Testimonial[] {
  const numbers = signeeNumbers(signatures)
  return uniqueSigners(signatures)
    .filter((signature) => signature.comment.trim().length > 0)
    .map((signature) => ({
      accountId: signature.accountId,
      comment: signature.comment.trim(),
      signedAt: signature.signedAt,
      recoveryRate: signature.recoveryRate ?? null,
      signeeNumber: numbers.get(signature.accountId.trim().toLowerCase()) ?? 0,
    }))
}

/**
 * The signature this account already made, if it made one.
 *
 * A topic is append-only: nothing on chain can stop a second message from the same
 * account. What the page can do is refuse to ask for one — so the reader is told what
 * they already signed instead of being handed the same button twice.
 */
export function signatureBy(
  signatures: readonly Signature[],
  accountId: string | null | undefined,
): Signature | null {
  const wanted = accountId?.trim().toLowerCase()
  if (!wanted) return null
  return signatures.find((signature) => signature.accountId.trim().toLowerCase() === wanted) ?? null
}

export function hashscanTopicUrl(network: HederaNetwork, topicId: string): string {
  const host = network === 'mainnet' ? 'hashscan.io/mainnet' : 'hashscan.io/testnet'
  return `https://${host}/topic/${topicId}`
}

/** Where a reader can watch an account — the treasury, in this campaign's case. */
export function hashscanAccountUrl(network: HederaNetwork, accountId: string): string {
  const host = network === 'mainnet' ? 'hashscan.io/mainnet' : 'hashscan.io/testnet'
  return `https://${host}/account/${accountId}`
}

/**
 * HashScan wants `shard.realm.num-seconds-nanos`, while wallets hand the
 * transaction id back as `shard.realm.num@seconds.nanos`. Both are the same
 * transaction; this is only the URL spelling.
 */
export function hashscanTransactionUrl(network: HederaNetwork, transactionId: string): string {
  const trimmed = transactionId.trim()
  const [account, timestamp] = trimmed.split('@')
  const normalised = timestamp ? `${account}-${timestamp.replace('.', '-')}` : trimmed
  return `${HASHSCAN_BASE[network]}/transaction/${normalised}`
}

/**
 * The mirror node's spelling of a transaction id. `TransactionId.toString()`
 * gives `0.0.1234@1700000000.000000000`; the REST API answers that form with
 * HTTP 400 and wants the dashed one. Same conversion as the treasury page.
 */
export function mirrorTransactionId(transactionId: string): string {
  return transactionId.trim().replace(/^(\d+\.\d+\.\d+)@(\d+)\.(\d+)$/, '$1-$2-$3')
}

export interface WaitOptions {
  /** How long to keep asking before giving up. */
  budgetMs?: number
  delayMs?: number
  sleep?: (ms: number) => Promise<void>
  fetchImpl?: typeof fetch
  aborted?: () => boolean
}

/**
 * The network's own word for one transaction — `SUCCESS`, `INVALID_SIGNATURE`,
 * anything else — or null while the mirror has not indexed it yet.
 *
 * This exists because a wallet going quiet is not an answer. The transaction id
 * is generated here, before the wallet is asked, so the chain can always be
 * asked back: the signature either landed or it did not.
 */
export async function fetchTransactionResult(
  network: HederaNetwork,
  transactionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const id = mirrorTransactionId(transactionId)
  if (!/^\d+\.\d+\.\d+-\d+-\d+$/.test(id)) return null
  try {
    const res = await fetchImpl(`${MIRROR_BASE[network]}/transactions/${encodeURIComponent(id)}`, {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return null
    const body = (await res.json()) as { transactions?: { result?: unknown }[] }
    const result = body.transactions?.[0]?.result
    return typeof result === 'string' && result.length > 0 ? result : null
  } catch {
    // A flaky read is not a verdict; the caller treats null as "not indexed".
    return null
  }
}

/** Poll the mirror until the transaction is indexed or the budget runs out. */
export async function waitForTransactionResult(
  network: HederaNetwork,
  transactionId: string,
  options: WaitOptions = {},
): Promise<string | null> {
  const { budgetMs = 45_000, delayMs = 2_000, sleep, fetchImpl = fetch, aborted } = options
  const pause = sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const polls = Math.max(1, Math.ceil(budgetMs / delayMs))
  for (let poll = 0; poll < polls; poll += 1) {
    if (aborted?.()) return null
    const result = await fetchTransactionResult(network, transactionId, fetchImpl)
    if (result) return result
    if (poll + 1 >= polls) return null
    await pause(delayMs)
  }
  return null
}

export interface FetchOptions {
  network: HederaNetwork
  topicId: string
  subject: string
  letterHash: string
  /** safety cap on pages of 100 messages */
  maxPages?: number
  /** Only messages with a sequence number greater than this. */
  sinceSequence?: number
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  /**
   * Called after every page with the signatures it held and the number of pages read
   * so far. A long topic is a walk of up to `maxPages` requests; the caller can show
   * what has arrived instead of waiting for the last page.
   */
  onPage?: (page: readonly Signature[], pagesRead: number) => void
}

/** The mirror answers at most 100 messages per page; there is no "everything" call. */
export const PAGE_SIZE = 100
/**
 * How far back the page is willing to read — 200 pages, 20 000 messages.
 *
 * The read walks the topic **oldest first**, so the first signers are never the
 * ones a growing topic pushes out of view; what a very long topic costs instead
 * is its newest messages on a first load, which the minute-by-minute refresh
 * picks up by sequence number. The bound is a request budget, not a policy: 200
 * pages is 200 sequential GETs on a cold load, and the page says so when it
 * stops there (`truncated`).
 */
export const MAX_PAGES = 200

/**
 * Read the topic from the public mirror node (no key, no backend).
 *
 * Oldest first, following the cursor until the topic is exhausted or MAX_PAGES is hit.
 * `sinceSequence` reads only what is newer than a message already held, which is what a
 * refresh does: the first load may walk two hundred pages, the minute-by-minute one asks
 * for what has been written since and usually gets an empty answer.
 */
export async function fetchSignatures(opts: FetchOptions): Promise<Signature[]> {
  const { network, topicId, subject, letterHash, maxPages = MAX_PAGES, sinceSequence, signal } = opts
  const doFetch = opts.fetchImpl ?? fetch
  if (!topicId) return []

  const after = sinceSequence !== undefined ? `&sequenceNumber=gt:${sinceSequence}` : ''
  let url: string | null =
    `${MIRROR_BASE[network]}/topics/${encodeURIComponent(topicId)}/messages?limit=${PAGE_SIZE}&order=asc${after}`
  const collected: Signature[] = []
  let pages = 0

  while (url && pages < maxPages) {
    const res = await doFetch(url, { signal, headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`Mirror node returned ${res.status}`)
    const body = (await res.json()) as {
      messages?: MirrorMessage[]
      links?: { next?: string | null }
    }
    const page = parseMessages(body.messages ?? [], { subject, letterHash })
    collected.push(...page)
    opts.onPage?.(page, pages + 1)
    const next = body.links?.next
    url = next ? (next.startsWith('http') ? next : `${MIRROR_BASE[network]}${next.replace(/^\/api\/v1/, '')}`) : null
    pages += 1
  }

  return collected.sort((a, b) => Number(a.consensusTimestamp) - Number(b.consensusTimestamp))
}
