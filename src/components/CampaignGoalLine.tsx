import { HbarMark } from './HbarMark'
import { CAMPAIGN_GOAL_USD, formatPercent, formatUsd, shareOf } from '../lib/campaign'
import { useTreasuryBalance } from '../hooks/useTreasuryBalance'

/**
 * The same figure the bar in the header shows, said out loud: what the treasury holds
 * against the sum the campaign is trying to raise.
 *
 * It sits above the eyebrow and borrows its type — small, tracked, upper case — but takes
 * the accent colour, so the number reads before the label above the title does. While the
 * balance is unknown it renders nothing at all: "$0.00" would be a lie told for a second.
 *
 * Off at the moment: the marker's tooltip carries the explanation instead. Kept working so
 * it can be switched back on without being rewritten.
 */
export function CampaignGoalLine() {
  const treasury = useTreasuryBalance()
  if (!treasury) return null

  const percent = formatPercent(shareOf(treasury.usd))

  return (
    <p className="text-[0.625rem] font-semibold tracking-[0.12em] text-accent uppercase min-[360px]:text-[0.6875rem] min-[360px]:tracking-[0.16em]">
      <span className="tabular-nums">Campaign Goal</span>
      <span aria-hidden="true" className="mx-1.5 opacity-50">
        ·
      </span>
      <span className="tabular-nums">
        {formatUsd(treasury.usd)} of {formatUsd(CAMPAIGN_GOAL_USD)}
      </span>
      <HbarMark className="ml-1 inline-block h-[0.8em] w-auto align-[-0.05em]" />
      <span className="ml-1.5 tabular-nums opacity-75">({percent})</span>
    </p>
  )
}
