import { useCallback, useEffect, useState } from 'react'
import { fetchSignatures, type Signature } from '../lib/hcs'
import { config } from '../config'

export interface SignatureState {
  status: 'closed' | 'loading' | 'ready' | 'error'
  signatures: Signature[]
  error?: string
}

export interface SignatureQuery {
  subject: string
  letterHash: string
}

export type SignatureFeed = SignatureState & {
  /** Re-read the topic now — after a signature was submitted, waiting a minute is silly. */
  refresh: () => void
}

/**
 * Reads the topic from the public mirror node. No backend, no key, no tracking:
 * one GET to a public API, repeated every minute while the tab is open.
 *
 * Both the slug and the hash come from the build (virtual:letter), so the page
 * can never read a different version of the letter than the one it shows.
 */
export function useSignatures({ subject, letterHash }: SignatureQuery): SignatureFeed {
  const [state, setState] = useState<SignatureState>({ status: 'closed', signatures: [] })
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), [])

  useEffect(() => {
    if (!config.topicId || !letterHash) {
      setState({ status: 'closed', signatures: [] })
      return
    }

    const controller = new AbortController()
    let cancelled = false

    const load = async (): Promise<void> => {
      try {
        const signatures = await fetchSignatures({
          network: config.network,
          topicId: config.topicId,
          subject,
          letterHash,
          signal: controller.signal,
        })
        if (!cancelled) setState({ status: 'ready', signatures })
      } catch (error) {
        if (cancelled || controller.signal.aborted) return
        setState({
          status: 'error',
          signatures: [],
          error: error instanceof Error ? error.message : 'unknown error',
        })
      }
    }

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
