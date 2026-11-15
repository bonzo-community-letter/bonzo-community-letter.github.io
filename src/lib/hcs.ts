export const PAYLOAD_VERSION = 1 as const

/** Matches the `app` field convention in Bonzo's own signing topic. */
export const APP = 'open-letter'
/** Names this agreement, like "redemption-waiver" does for the recovery portal. */
export const AGREEMENT = 'bonzo-recovery-letter'

export type HederaNetwork = 'mainnet' | 'testnet'

export const HCS_MAX_MESSAGE_BYTES = 1024
/**
 * Policy cap on the optional comment. Well below what HCS allows so the whole
 * payload always fits with headroom, whatever the account id and timestamp cost.
 */
export const MAX_COMMENT_BYTES = 512

/**
 * The message a signer submits. Deliberately modelled on the format Bonzo used
 * for the recovery portal's terms (app / accountId / agreement / version /
 * <hash> / signedAt), with one addition: an optional comment.
 *
 * The message carries the *hash* of the letter, not the letter — the same
 * primitive as the portal's termsHash, and small enough to stay far under HCS's
 * 1 KB cap.
 */
export interface SignaturePayload {
  app: string
  /** signer's Hedera account id, e.g. 0.0.1234 */
  accountId: string
  agreement: string
  version: number
  /** letter id, e.g. "bonzo-recovery-2026-11" */
  letterId: string
  /** SHA-256 of the letter text, lowercase hex — computed at build time */
  letterHash: string
  /** ISO-8601 UTC timestamp, set by the client */
  signedAt: string
  /** optional, signer-authored, permanent and public */
  comment?: string
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
  letterId: string
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

const ACCOUNT_ID = /^\d+\.\d+\.\d+$/
const SHA256_HEX = /^[a-f0-9]{64}$/

const byteLength = (s: string): number => new TextEncoder().encode(s).length

/** Deterministic JSON: keys sorted, no insignificant whitespace. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

export function encodePayload(payload: SignaturePayload): string {
  return canonicalJson(payload)
}

export function payloadByteLength(payload: SignaturePayload): number {
  return byteLength(encodePayload(payload))
}

export function commentByteLength(comment: string): number {
  return byteLength(comment)
}

/** Topic memo convention, mirroring Bonzo's `bonzo:redemption-waiver:v1:<hash>`. */
export function topicMemo(letterHash: string): string {
  return `${APP}:${AGREEMENT}:v${PAYLOAD_VERSION}:${letterHash}`
}

/**
 * Build the exact message a signer will submit, or explain why it cannot be
 * submitted. Everything that can be checked before a wallet is involved is
 * checked here, so the UI never asks for a signature that would fail.
 */
export function buildSignature(input: SignatureInput): BuildResult {
  const errors: string[] = []

  if (!ACCOUNT_ID.test(input.accountId)) errors.push('accountId must look like 0.0.1234')
  if (!input.letterId) errors.push('letterId is required')
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
    app: APP,
    accountId: input.accountId,
    agreement: AGREEMENT,
    version: PAYLOAD_VERSION,
    letterId: input.letterId,
    letterHash: input.letterHash,
    signedAt: input.signedAt ?? new Date().toISOString(),
    ...(comment ? { comment } : {}),
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
    p.app === APP &&
    p.agreement === AGREEMENT &&
    p.version === PAYLOAD_VERSION &&
    typeof p.accountId === 'string' &&
    typeof p.letterId === 'string' &&
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
 * Anything else on the topic (older drafts, other agreements, junk) is ignored.
 */
export function parseMessages(
  messages: readonly MirrorMessage[],
  opts: { letterId: string; letterHash: string },
): Signature[] {
  const out: Signature[] = []
  for (const m of messages) {
    const payload = decodeMessage(m.message)
    if (!payload) continue
    if (payload.letterId !== opts.letterId) continue
    if (payload.letterHash !== opts.letterHash) continue
    out.push({
      ...payload,
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

export interface FetchOptions {
  network: HederaNetwork
  topicId: string
  letterId: string
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
  const { network, topicId, letterId, letterHash, maxPages = 5, signal } = opts
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
    collected.push(...parseMessages(body.messages ?? [], { letterId, letterHash }))
    const next = body.links?.next
    url = next ? (next.startsWith('http') ? next : `${MIRROR_BASE[network]}${next.replace(/^\/api\/v1/, '')}`) : null
    pages += 1
  }

  return collected.sort((a, b) => Number(a.consensusTimestamp) - Number(b.consensusTimestamp))
}
