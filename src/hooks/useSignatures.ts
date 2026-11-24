import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_PAGES, PAGE_SIZE, fetchSignatures, type Signature } from '../lib/hcs'
import { config } from '../config'

export interface SignatureState {
  status: 'closed' | 'loading' | 'ready' | 'error'
  signatures: Signature[]
  error?: string
  /** True when the read stopped at its page bound: there are older messages unread. */
  truncated?: boolean
}

export interface SignatureQuery {
  subject: string
  letterHash: string
}

export type SignatureFeed = SignatureState & {
  /** Re-read the topic now — after a signature was submitted, waiting a minute is silly. */
  refresh: () => void
}

/** Newest sequence number we already hold, or undefined for a first, full read. */
function newestSequence(signatures: readonly Signature[]): number | undefined {
  let highest: number | undefined
  for (const signature of signatures) {
    const sequence = Number(signature.sequence)
    if (Number.isFinite(sequence) && (highest === undefined || sequence > highest)) highest = sequence
  }
  return highest
}

/** Merge a fresh page into what is held, by sequence number, oldest first. */
function merge(held: readonly Signature[], incoming: readonly Signature[]): Signature[] {
  const bySequence = new Map<number, Signature>()
  for (const signature of held) bySequence.set(Number(signature.sequence), signature)
  for (const signature of incoming) bySequence.set(Number(signature.sequence), signature)
  return [...bySequence.values()].sort((a, b) => Number(a.sequence) - Number(b.sequence))
}

/**
 * Reads the topic from the public mirror node. No backend, no key, no tracking:
 * one GET to a public API, repeated every minute while the tab is open.
 *
 * The first read walks the whole topic (up to MAX_PAGES). Every read after that asks
 * only for what is newer than the highest sequence number already held, so a minute
 * costs one request with usually nothing in it — a topic with a thousand signatures is
 * no slower to watch than one with three.
 *
 * Both the slug and the hash come from the build (virtual:letter), so the page
 * can never read a different version of the letter than the one it shows.
 */
export function useSignatures({ subject, letterHash }: SignatureQuery): SignatureFeed {
  const [state, setState] = useState<SignatureState>({ status: 'closed', signatures: [] })
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), [])

  // The feed the loop reads from. State would do, but this is what the next request is
  // built from, and it must not lag a render behind.
  const held = useRef<Signature[]>([])
  const complete = useRef(false)

  useEffect(() => {
    if (!config.topicId || !letterHash) {
      setState({ status: 'closed', signatures: [] })
      return
    }

    const controller = new AbortController()
    let cancelled = false

    const load = async (): Promise<void> => {
      try {
        const since = complete.current ? newestSequence(held.current) : undefined
        const incoming = await fetchSignatures({
          network: config.network,
          topicId: config.topicId,
          subject,
          letterHash,
          sinceSequence: since,
          signal: controller.signal,
        })
        if (cancelled) return

        const merged = since === undefined ? incoming : merge(held.current, incoming)
        held.current = merged
        // A full read that came back shorter than its own page bound saw the whole topic.
        const truncated = since === undefined && incoming.length >= MAX_PAGES * PAGE_SIZE
        if (since === undefined) complete.current = !truncated
        setState({ status: 'ready', signatures: merged, truncated })
      } catch (error) {
        if (cancelled || controller.signal.aborted) return
        setState((previous) => ({
          status: 'error',
          signatures: previous.signatures,
          error: error instanceof Error ? error.message : 'unknown error',
        }))
      }
    }

    held.current = []
    complete.current = false
    setState({ status: 'loading', signatures: [] })
    void load()
    const timer = window.setInterval(() => void load(), 60_000)

    return () => {
      cancelled = true
      controller.abort()
      window.clearInterval(timer)
    }
  }, [subject, letterHash, refreshKey])

  return { ...state, refresh }
}
