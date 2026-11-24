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
  const ordered: Record<string, string | number> = {}
  for (const key of FIELD_ORDER) ordered[key] = payload[key]
  return JSON.stringify(ordered, null, 2)
}

export function commentByteLength(comment: string): number {
  return byteLength(comment)
}

/** Topic memo convention: `<subject>:v<version>:<hash>`. */
export function topicMemo(subject: string, letterHash: string): string {
  return `${subject}:v${PAYLOAD_VERSION}:${letterHash}`
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

  if (errors.length > 0) return { ok: false, errors }

  const payload: SignaturePayload = {
    accountId: input.accountId,
    subject: input.subject,
    letterHash: input.letterHash,
    signedAt: input.signedAt ?? new Date().toISOString(),
    version: PAYLOAD_VERSION,
    comment: comment ?? '',
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
    (p.comment === undefined || typeof p.comment === 'string')
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
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

/**
 * Read the topic from the public mirror node (no key, no backend).
 * Newest first, bounded number of pages.
 */
export async function fetchSignatures(opts: FetchOptions): Promise<Signature[]> {
  const { network, topicId, subject, letterHash, maxPages = 5, signal } = opts
  const doFetch = opts.fetchImpl ?? fetch
  if (!topicId) return []

  let url: string | null =
    `${MIRROR_BASE[network]}/topics/${encodeURIComponent(topicId)}/messages?limit=100&order=desc`
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
