export const PAYLOAD_VERSION = 1 as const

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
 */
export interface SignaturePayload {
  /** signer's Hedera account id, e.g. 0.0.1234 */
  accountId: string
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
  sequence: number
  consensusTimestamp: string
  payerAccountId: string
}

export interface MirrorMessage {
  consensus_timestamp: string
  message: string
  payer_account_id?: string
  sequence_number: number
}

export interface SignatureInput {
  accountId: string
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
 * `accountId`, `subject`, `version`, `letterHash`, `signedAt`, `comment`.
 *
 * A fixed order — rather than sorted keys — is what makes the bytes
 * reproducible: every client emits the same string for the same values.
 */
export const FIELD_ORDER = [
  'accountId',
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

  if (!ACCOUNT_ID.test(input.accountId)) errors.push('accountId must look like 0.0.1234')
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
    accountId: input.accountId,
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
    typeof p.accountId === 'string' &&
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
 */
export function parseMessages(
  messages: readonly MirrorMessage[],
  opts: { subject: string; letterHash: string },
): Signature[] {
  const out: Signature[] = []
  for (const m of messages) {
    const payload = decodeMessage(m.message)
    if (!payload) continue
    if (payload.subject !== opts.subject) continue
    if (payload.letterHash !== opts.letterHash) continue
    out.push({
      ...payload,
      comment: payload.comment ?? '',
      sequence: m.sequence_number,
      consensusTimestamp: m.consensus_timestamp,
      payerAccountId: m.payer_account_id ?? payload.accountId,
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
  return uniqueSigners(signatures)
    .filter((signature) => signature.comment.trim().length > 0)
    .map((signature) => ({
      accountId: signature.accountId,
      comment: signature.comment.trim(),
      signedAt: signature.signedAt,
      recoveryRate: signature.recoveryRate ?? null,
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
}

/** The mirror answers at most 100 messages per page; there is no "everything" call. */
export const PAGE_SIZE = 100
/**
 * How far back the page is willing to read. 20 pages is 2 000 messages — a letter with
 * more signatures than that is a different problem, but the page must not stop at a few
 * hundred without saying so, which is what a 5-page bound did.
 */
export const MAX_PAGES = 20

/**
 * Read the topic from the public mirror node (no key, no backend).
 *
 * Newest first, following the cursor until the topic is exhausted or MAX_PAGES is hit.
 * `sinceSequence` reads only what is newer than a message already held, which is what a
 * refresh does: the first load may walk twenty pages, the minute-by-minute one asks for
 * what has been written since and usually gets an empty answer.
 */
export async function fetchSignatures(opts: FetchOptions): Promise<Signature[]> {
  const { network, topicId, subject, letterHash, maxPages = MAX_PAGES, sinceSequence, signal } = opts
  const doFetch = opts.fetchImpl ?? fetch
  if (!topicId) return []

  const after = sinceSequence !== undefined ? `&sequenceNumber=gt:${sinceSequence}` : ''
  let url: string | null =
    `${MIRROR_BASE[network]}/topics/${encodeURIComponent(topicId)}/messages?limit=${PAGE_SIZE}&order=desc${after}`
  const collected: Signature[] = []
  let pages = 0

  while (url && pages < maxPages) {
    const res = await doFetch(url, { signal, headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`Mirror node returned ${res.status}`)
    const body = (await res.json()) as {
      messages?: MirrorMessage[]
      links?: { next?: string | null }
    }
    collected.push(...parseMessages(body.messages ?? [], { subject, letterHash }))
    const next = body.links?.next
    url = next ? (next.startsWith('http') ? next : `${MIRROR_BASE[network]}${next.replace(/^\/api\/v1/, '')}`) : null
    pages += 1
  }

  return collected.sort((a, b) => Number(a.consensusTimestamp) - Number(b.consensusTimestamp))
}
