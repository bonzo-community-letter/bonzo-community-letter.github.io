import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HbarMark } from './HbarMark'
import { CAMPAIGN_GOAL_USD, MILESTONES, formatPercent, formatUsd, shareOf } from '../lib/campaign'
import { useTreasuryBalance } from '../hooks/useTreasuryBalance'
import { useTipPlacement } from '../hooks/useTipPlacement'

/**
 * How far the campaign's funding has come, as a hairline at the bottom edge of the bar.
 *
 * The marker at the end of the fill carries the currency and the share: the Hedera mark
 * inside the circle, the percentage beside it. Both are drawn as an overlay — the bar is
 * three pixels in a fifty-six pixel header, and nothing here may make the page taller.
 *
 * The circle is the only moving thing on the page: it says the number is live, not a
 * drawing. It pulses slowly — a heartbeat, not a spinner — and holds still for anyone who
 * asked their system for reduced motion.
 *
 * It is also the button: the campaign is not obvious from a bar, so hovering or focusing
 * the marker explains what the money buys. The marker sits beside the `progressbar` rather
 * than inside it — a button inside a progressbar is not a thing a screen reader can make
 * sense of.
 */
export function CampaignProgress() {
  const treasury = useTreasuryBalance()
  const usd = treasury?.usd ?? null
  const goal = CAMPAIGN_GOAL_USD
  const share = shareOf(usd, goal)
  const percent = formatPercent(share)
  // only at the very end, where a label to the right would leave the bar
  const flipped = share > 0.94
  // At a fraction of a percent the fill is thinner than the marker is wide, and centring
  // the marker on it would push half of it out of the window.
  const atEdge = share < 0.01

  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement | null>(null)
  const panel = useRef<HTMLSpanElement | null>(null)
  const at = useTipPlacement({ anchor: button, panel, open, side: 'below', align: 'left', width: 270 })

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="absolute inset-x-0 bottom-0 h-[3px] overflow-visible">
      <div
        role="progressbar"
        aria-label="Campaign funding"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={usd === null ? undefined : Math.min(usd, goal)}
        aria-valuetext={
          usd === null ? 'Funding is being read' : `${formatUsd(usd)} of ${formatUsd(goal)} raised, ${percent}`
        }
        className="h-full bg-rule/40"
      >
        {/* the fill grows from the left */}
        <div
          className="h-full bg-accent transition-[width] duration-700 ease-out"
          style={{ width: `${share * 100}%` }}
        />
      </div>

      {usd !== null ? (
        <>
          <button
            ref={button}
            type="button"
            aria-label="What the campaign funds"
            aria-describedby="campaign-tip"
            aria-expanded={open}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onClick={() => setOpen((was) => !was)}
            style={{ left: `${share * 100}%` }}
            className={`campaign-dot absolute top-1/2 flex h-[20px] w-[20px] -translate-y-1/2 cursor-help items-center justify-center rounded-full bg-accent text-page ${
              atEdge ? '' : '-translate-x-1/2'
            }`}
          >
            <HbarMark className="h-[14px] w-auto" />
          </button>
          {/* In the last few percent a label to the right of the marker would run off the
              bar; there it moves to the other side, over the fill, in the page colour. */}
          <span
            aria-hidden="true"
            style={{ left: `${share * 100}%` }}
            className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[0.5625rem] leading-none tracking-tight text-ink-soft tabular-nums ${
              flipped ? 'mr-2 -translate-x-[calc(100%+14px)] text-page' : 'ml-[14px]'
            }`}
          >
            {percent}
          </span>
        </>
      ) : null}

      {createPortal(
        <span
          ref={panel}
          id="campaign-tip"
          role="tooltip"
          style={{ position: 'fixed', top: at?.top ?? -9999, left: at?.left ?? -9999, width: 270 }}
          className={`pointer-events-none z-[60] max-w-[calc(100vw-1rem)] rounded-sm border border-rule bg-page px-3 py-2 text-left text-[0.6875rem] font-normal leading-relaxed text-ink-soft shadow-xl transition-opacity duration-150 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="block">
            The campaign aims to lift Hedera’s mainnet to 100 TPS: 1 tinybar per transaction to
            the staking rewards account (0.0.800).
          </span>
          <span className="mt-1.5 block">
            We hope this TPS increase will draw attention to this open letter, since each
            transaction memo will contain a link to this website.
          </span>
          <span className="mt-1.5 block text-ink-faint">
            {MILESTONES.map((m) => `${m.hours} h ${formatUsd(m.usd)}`).join(' · ')} — the bar
            fills towards the last milestone.
          </span>
        </span>,
        document.body,
      )}
    </div>
  )
}
