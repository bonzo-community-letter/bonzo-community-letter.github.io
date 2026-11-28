import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HbarMark } from './HbarMark'
import { CAMPAIGN_GOAL_USD, MILESTONES, formatPercent, formatUsd, shareOf } from '../lib/campaign'
import { useTreasuryBalance } from '../hooks/useTreasuryBalance'
import { useTipPlacement } from '../hooks/useTipPlacement'

/**
 * How far the campaign's funding has come, as a hairline at the bottom edge of the bar.
 *
 * The marker at the end of the fill carries the currency: the Hedera mark inside the
 * circle. It is drawn as an overlay — the bar is three pixels in a fifty-six pixel header,
 * and nothing here may make the page taller. The share itself is not written beside it; the
 * tooltip and the donate dialog say it.
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
    // Inset by the marker's own air: the track then starts where the marker can sit, so at
    // 0% the fill is not a stray sliver to the left of a marker that has been pushed in.
    <div className="absolute inset-x-1 bottom-0 z-10 h-[3px] overflow-visible">
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
            // The marker is centred on the fill, but never closer to an edge than its own
            // half: at 0% and at 100% it would otherwise be cut by the window. The half
            // follows the size, so a resting dot does not sit four pixels away from a fill
            // that is thinner than itself, and a grown one still keeps its air.
            style={{ left: `clamp(${open ? 10 : 4}px, ${share * 100}%, calc(100% - ${open ? 10 : 4}px))` }}
            // The button is a twenty-pixel target around an eight-pixel dot: the dot is
            // what the page shows, the target is what a pointer can find. Growing the dot
            // instead would make it either hard to hit or too loud at rest.
            className="absolute top-1/2 flex h-[20px] w-[20px] -translate-x-1/2 -translate-y-1/2 cursor-help items-center justify-center"
          >
            <span
              // A dot on the line, not a badge: eight pixels until someone reaches for it.
              // The tooltip state drives the size too, so the marker is never large with the
              // explanation closed or small with it open — the two cannot disagree.
              className={`campaign-dot flex items-center justify-center overflow-hidden rounded-full bg-accent text-page transition-[width,height] duration-200 ease-out ${
                open ? 'h-[20px] w-[20px]' : 'h-[8px] w-[8px]'
              }`}
            >
              <HbarMark
                className={`h-[14px] w-auto shrink-0 transition-opacity duration-150 ${
                  open ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </span>
          </button>
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
          {/* The number the bar is drawing, in the words the donate panel uses for it: the
              bar alone cannot be read to a dollar, and the marker is where people look. */}
          {usd !== null ? (
            <span className="block text-ink">
              Raised so far: {formatUsd(usd)} ({percent})
            </span>
          ) : null}
          <span className={usd !== null ? 'mt-1.5 block' : 'block'}>
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
          {/* The donate button is at the foot of the letter, and nothing in the bar says so. */}
          <span className="mt-1.5 block text-ink">Scroll to the letter’s end to donate!</span>
        </span>,
        document.body,
      )}
    </div>
  )
}
