import { useEffect, useState } from 'react'
import { fetchSignatures, type Signature } from '../lib/hcs'
import { config } from '../config'

export interface SignatureState {
  status: 'closed' | 'loading' | 'ready' | 'error'
  signatures: Signature[]
  error?: string
}

/**
 * Reads the topic from the public mirror node. No backend, no key, no tracking:
 * one GET to a public API, repeated every minute while the tab is open.
 */
export function useSignatures(letterHash: string | null, letterId: string): SignatureState {
  const [state, setState] = useState<SignatureState>({ status: 'closed', signatures: [] })

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
          letter: letterId,
          hash: letterHash,
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
  }, [letterHash, letterId])

  return state
}
