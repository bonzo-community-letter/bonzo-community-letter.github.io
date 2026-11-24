/**
 * "This browser has already signed with this account."
 *
 * The topic is the record, but the mirror needs a few seconds to index a message —
 * and in that window the page would happily offer the button again, letting one
 * account put two signatures on a topic that has no delete. So the fact is also kept
 * here, for the one reader who just signed: `localStorage`, because it has to survive
 * a reload, keyed by the letter (subject + hash) so a new letter starts clean.
 */
import type { HederaNetwork } from './hcs'

export interface LocalSignature {
  accountId: string
  subject: string
  letterHash: string
  signedAt: string
  network: HederaNetwork
}

const KEY = 'open-letter:signed'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function read(): LocalSignature[] {
  try {
    const raw = storage()?.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is LocalSignature => {
      if (typeof entry !== 'object' || entry === null) return false
      const candidate = entry as Partial<LocalSignature>
      return (
        typeof candidate.accountId === 'string' &&
        typeof candidate.subject === 'string' &&
        typeof candidate.letterHash === 'string' &&
        typeof candidate.signedAt === 'string' &&
        (candidate.network === 'mainnet' || candidate.network === 'testnet')
      )
    })
  } catch {
    return []
  }
}

export function rememberSignature(entry: LocalSignature): void {
  try {
    const kept = read().filter(
      (existing) =>
        !(
          existing.accountId === entry.accountId &&
          existing.subject === entry.subject &&
          existing.letterHash === entry.letterHash &&
          existing.network === entry.network
        ),
    )
    storage()?.setItem(KEY, JSON.stringify([...kept, entry]))
  } catch {
    // A browser that will not store costs a few seconds of certainty, nothing more.
  }
}

/** The signature this browser already made for this letter, if any. */
export function localSignature(
  accountId: string | null | undefined,
  subject: string,
  letterHash: string,
  network: HederaNetwork,
): LocalSignature | null {
  const wanted = accountId?.trim().toLowerCase()
  if (!wanted) return null
  return (
    read().find(
      (entry) =>
        entry.accountId.toLowerCase() === wanted &&
        entry.subject === subject &&
        entry.letterHash === letterHash &&
        entry.network === network,
    ) ?? null
  )
}

/** Used by the tests; the page never needs to forget a signature. */
export function forgetSignatures(): void {
  try {
    storage()?.removeItem(KEY)
  } catch {
    // Nothing to undo.
  }
}
