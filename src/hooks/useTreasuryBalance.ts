import { useEffect, useState } from 'react'
import { config } from '../config'
import { MIRROR_BASE } from '../lib/hcs'

/**
 * What the campaign's treasury holds right now, in dollars.
 *
 * Two reads from the public mirror node, both of them open to any browser: the account's
 * balance in tinybar, and the network's own HBAR exchange rate. Hedera prices a
 * transaction in dollars and charges it in HBAR, so the dollar figure is the one that
 * stays still — the page states the campaign in dollars and converts the balance, never
 * the other way round.
 *
 * `null` while it is unknown: a number that starts at zero and jumps is worse than one
 * that says nothing until it knows.
 *
 * The bar in the header and the dialog show the same figure, so the read lives here once,
 * outside React: two components mounting means two subscribers, not two requests, and
 * they can never disagree about what the treasury holds.
 *
 * The balance is not the same as donations: anything else that ever lands in the account
 * is in this number too. For a campaign treasury that is the honest reading of "funded".
 */
export type Treasury = { hbar: number; usdPerHbar: number; usd: number }

let current: Treasury | null = null
const listeners = new Set<(value: Treasury | null) => void>()
let started = false
let inFlight = false

function publish(value: Treasury): void {
  // A poll that found the same balance is not news. Publishing it anyway re-rendered
  // every subscriber once a minute for nothing — and, before the focus fix, moved the
  // caret out of whatever was being typed in.
  if (current !== null && current.hbar === value.hbar && current.usdPerHbar === value.usdPerHbar) return
  current = value
  for (const listener of listeners) listener(value)
}

async function read(): Promise<void> {
  const account = config.treasuryAccountId
  if (!account || inFlight) return
  inFlight = true
  const base = MIRROR_BASE[config.network]
  try {
    const [accountRes, rateRes] = await Promise.all([
      fetch(`${base}/accounts/${encodeURIComponent(account)}`, {
        headers: { accept: 'application/json' },
      }),
      fetch(`${base}/network/exchangerate`, { headers: { accept: 'application/json' } }),
    ])
    if (!accountRes.ok || !rateRes.ok) return

    const body: unknown = await accountRes.json()
    const tinybar =
      typeof body === 'object' && body !== null && 'balance' in body
        ? (body as { balance?: { balance?: unknown } }).balance?.balance
        : undefined

    const rate: unknown = await rateRes.json()
    const cents =
      typeof rate === 'object' && rate !== null && 'current_rate' in rate
        ? (rate as { current_rate?: { cent_equivalent?: unknown; hbar_equivalent?: unknown } }).current_rate
        : undefined
    const centEquivalent = cents?.cent_equivalent
    const hbarEquivalent = cents?.hbar_equivalent

    if (typeof tinybar !== 'number' || !Number.isFinite(tinybar)) return
    if (typeof centEquivalent !== 'number' || typeof hbarEquivalent !== 'number' || !hbarEquivalent) return

    const hbar = tinybar / 1e8
    const usdPerHbar = centEquivalent / hbarEquivalent / 100
    publish({ hbar, usdPerHbar, usd: hbar * usdPerHbar })
  } catch {
    // a mirror node that is slow or down is not an error the reader needs
  } finally {
    inFlight = false
  }
}

function start(): void {
  if (started) return
  started = true
  void read()
  // the treasury moves when somebody donates, not on a clock — once a minute is plenty
  setInterval(() => void read(), 60_000)
}

export function useTreasuryBalance(): Treasury | null {
  const [value, setValue] = useState(current)

  useEffect(() => {
    listeners.add(setValue)
    setValue(current)
    start()
    return () => {
      listeners.delete(setValue)
    }
  }, [])

  return value
}
