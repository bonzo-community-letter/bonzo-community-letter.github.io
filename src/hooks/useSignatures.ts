import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_PAGES, PAGE_SIZE, fetchSignatures, type Signature } from '../lib/hcs'
import { config } from '../config'

export interface SignatureState {
  status: 'closed' | 'loading' | 'ready' | 'error'
  signatures: Signature[]
  error?: string
  /** True when the read stopped at its page bound: there are older messages unread. */
  truncated?: boolean
  /** True while a first walk of the topic is still in progress; the list grows as it goes. */
  reading?: boolean
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
  if (incoming.length === 0) return held as Signature[]
  // The topic is walked oldest first, so a page usually continues where the last one
  // stopped. Appending then is linear; sorting twenty thousand signatures per page two
  // hundred times is not.
  const lastHeld = held.length > 0 ? Number(held[held.length - 1]!.sequence) : -1
  const firstIncoming = Number(incoming[0]!.sequence)
  if (firstIncoming > lastHeld) return [...held, ...incoming]

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
  /** True once a first read has finished; after that every read asks only for what is new. */
  const loaded = useRef(false)
  /** Sticky: the first read stopped at its page bound, so the topic is longer than shown. */
  const truncated = useRef(false)

  useEffect(() => {
    if (!config.topicId || !letterHash) {
      setState({ status: 'closed', signatures: [] })
      return
    }

    const controller = new AbortController()
    let cancelled = false

    const load = async (): Promise<void> => {
      try {
        const since = loaded.current ? newestSequence(held.current) : undefined
        const walking = since === undefined
        const incoming = await fetchSignatures({
          network: config.network,
          topicId: config.topicId,
          subject,
          letterHash,
          sinceSequence: since,
          signal: controller.signal,
          onPage: (page) => {
            if (cancelled) return
            // Each page is merged and shown before the next request goes out, so the
            // count climbs while the topic is walked instead of appearing all at once.
            const merged = merge(held.current, page)
            held.current = merged
            setState({
              status: 'ready',
              signatures: merged,
              reading: walking,
              truncated: truncated.current,
            })
          },
        })
        if (cancelled) return

        const merged = since === undefined ? incoming : merge(held.current, incoming)
        held.current = merged
        // A first read that came back at its own page bound did not see the whole topic.
        // The flag is sticky, and the next read still asks only for what is new — a bound
        // that made every refresh walk two hundred pages again would be a load of its own.
        if (since === undefined) {
          truncated.current = incoming.length >= MAX_PAGES * PAGE_SIZE
          loaded.current = true
        }
        setState({ status: 'ready', signatures: merged, reading: false, truncated: truncated.current })
      } catch (error) {
        if (cancelled || controller.signal.aborted) return
        setState((previous) => ({
          status: 'error',
          signatures: previous.signatures,
          reading: false,
          error: error instanceof Error ? error.message : 'unknown error',
        }))
      }
    }

    held.current = []
    loaded.current = false
    truncated.current = false
    setState({ status: 'loading', signatures: [], reading: true })
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
