export const PAYLOAD_KIND = 'open-letter-signature' as const
export const PAYLOAD_VERSION = 1 as const

export type HederaNetwork = 'mainnet' | 'testnet'

/**
 * The message a signer submits to the HCS topic. Kept deliberately small and
 * self-describing so anyone can re-verify a signature without our help:
 * the `hash` binds the signature to one exact version of the letter text.
 *
 * HCS caps a message at 1024 bytes; the canonical encoding below stays far
 * below that (see `payloadByteLength`).
 */
export interface SignaturePayload {
  v: typeof PAYLOAD_VERSION
  kind: typeof PAYLOAD_KIND
  /** letter id, e.g. "bonzo-recovery-2026-11" */
  letter: string
  /** SHA-256 of the letter text, hex */
  hash: string
  /** signer's Hedera account id, e.g. 0.0.1234 */
  account: string
  /** ISO-8601 UTC timestamp set by the client */
  ts: string
  /** optional, self-declared */
  name?: string
  role?: string
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

export const MIRROR_BASE: Record<HederaNetwork, string> = {
  mainnet: 'https://mainnet-public.mirrornode.hedera.com/api/v1',
  testnet: 'https://testnet.mirrornode.hedera.com/api/v1',
}

export const HCS_MAX_MESSAGE_BYTES = 1024

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
  return new TextEncoder().encode(encodePayload(payload)).length
}

function isSignaturePayload(value: unknown): value is SignaturePayload {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  return (
    p.v === PAYLOAD_VERSION &&
    p.kind === PAYLOAD_KIND &&
    typeof p.letter === 'string' &&
    typeof p.hash === 'string' &&
    typeof p.account === 'string' &&
    typeof p.ts === 'string'
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
 * Anything else on the topic (other payload kinds, older drafts, junk) is ignored.
 */
export function parseMessages(
  messages: readonly MirrorMessage[],
  opts: { letter: string; hash: string },
): Signature[] {
  const out: Signature[] = []
  for (const m of messages) {
    const payload = decodeMessage(m.message)
    if (!payload) continue
    if (payload.letter !== opts.letter) continue
    if (payload.hash !== opts.hash) continue
    out.push({
      ...payload,
      sequence: m.sequence_number,
      consensusTimestamp: m.consensus_timestamp,
      payerAccountId: m.payer_account_id ?? payload.account,
    })
  }
  return out.sort((a, b) => Number(a.consensusTimestamp) - Number(b.consensusTimestamp))
}

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
  letter: string
  hash: string
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
  const { network, topicId, letter, hash, maxPages = 5, signal } = opts
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
    collected.push(...parseMessages(body.messages ?? [], { letter, hash }))
    const next = body.links?.next
    url = next ? (next.startsWith('http') ? next : `${MIRROR_BASE[network]}${next.replace(/^\/api\/v1/, '')}`) : null
    pages += 1
  }

  return collected.sort((a, b) => Number(a.consensusTimestamp) - Number(b.consensusTimestamp))
}
