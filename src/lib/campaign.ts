/**
 * What the campaign asks of the network — in dollars, because that is the unit the price
 * is fixed in. Hedera quotes a transaction in dollars and charges it in HBAR, so the HBAR
 * figure moves with the market while the dollar figure does not. Everything the reader
 * sees is dollars; the HBAR is converted at the network's own rate when it is read.
 *
 * The transaction itself: 1 tinybar to the staking rewards account 0.0.800, 100 times a
 * second. The tinybar is noise; the fee is the cost, and the record says it is ≈$0.0001
 * per transfer — 184,941–194,037 tinybar at today's rate, the price list's headline.
 */
export const CAMPAIGN_TPS = 100
export const TRANSFERS_PER_HOUR = 3_600 * CAMPAIGN_TPS
export const FEE_PER_TRANSFER_USD = 0.0001

/** $36 an hour at 100 TPS. */
export const USD_PER_HOUR = TRANSFERS_PER_HOUR * FEE_PER_TRANSFER_USD

export type Milestone = { hours: number; usd: number }

/**
 * The three milestones, cheapest first: a day, two days, three. The campaign runs as far
 * as the treasury carries it, and these are the marks it is measured against.
 */
export const MILESTONES: Milestone[] = [
  { hours: 24, usd: 24 * USD_PER_HOUR },
  { hours: 48, usd: 48 * USD_PER_HOUR },
  { hours: 72, usd: 72 * USD_PER_HOUR },
]

/** The last milestone: what the bar fills towards. */
export const CAMPAIGN_GOAL_USD = 72 * USD_PER_HOUR

/** How far the campaign has come, clamped to 0…1. `null` while the balance is unknown. */
export function shareOf(usd: number | null, goal = CAMPAIGN_GOAL_USD): number {
  if (usd === null) return 0
  return Math.max(0, Math.min(1, usd / goal))
}

/**
 * Dollars as the page writes them: cents below a hundred, whole dollars above. "$3.48" is
 * a sum somebody can check on HashScan; "$2,592" is a target, and cents there would be
 * precision the estimate does not have.
 */
export function formatUsd(usd: number): string {
  const cents = usd < 100
  return `$${usd.toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })}`
}

/**
 * The share as a percentage. Against $2,592 a real balance is a fraction of one per cent,
 * and "0%" for a treasury that holds something is a worse lie than "0.13%".
 */
export function formatPercent(share: number): string {
  const percent = share * 100
  if (percent >= 10) return `${Math.round(percent)}%`
  if (percent >= 1) return `${percent.toFixed(1)}%`
  return `${percent.toFixed(2)}%`
}
