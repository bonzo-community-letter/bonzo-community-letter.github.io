import { useLayoutEffect, useRef } from 'react'
import { page } from '../content/page'
import { ENVELOPE, envelopeGutter, envelopeHidden, envelopeTravel } from './EnvelopeOverlay'
import { letterText } from 'virtual:letter'

/** How far through the flap's travel the paper should reach the fold. */
const CROSSING = 0.62

/**
 * The sheet starts inside the envelope, not at its opening: the gap above it is the
 * distance it travels to come out, and the envelope covers it until the page scrolls.
 *
 * That distance cannot be a fixed number of pixels — the envelope's height follows the
 * viewport (588:363), and the fold sits a fixed fraction of it above the bottom edge.
 * So the gap is measured: place the paper where it is `CROSSING` of the reveal away
 * from meeting the fold.
 */
function useStartDepth(ref: React.RefObject<HTMLDivElement | null>): void {
  useLayoutEffect(() => {
    const place = (): void => {
      const el = ref.current
      if (!el) return

      const bodyWidth = Math.min(window.innerWidth, ENVELOPE.maxWidth) - 2 * envelopeGutter()
      const bodyHeight = bodyWidth / ENVELOPE.aspect
      const fold = window.innerHeight - (1 - envelopeHidden(window.innerWidth)) * bodyHeight
      // how far the fold itself descends per pixel of scroll
      const foldPerScroll = (envelopeTravel(window.innerWidth) / ENVELOPE.exit) * bodyHeight
      const crossing = CROSSING * ENVELOPE.reveal
      const target = fold + crossing * (1 + foldPerScroll)

      const top = el.getBoundingClientRect().top + window.scrollY
      const height = Math.max(0, Math.round(target - top))
      if (Math.abs(height - el.offsetHeight) > 1) el.style.height = `${height}px`
    }

    place()
    // the first run can happen before the stylesheet lands, when the hero is still
    // unlaid-out; measure again once the layout exists and whenever it changes
    const frame = requestAnimationFrame(place)
    const observer = new ResizeObserver(place)
    const hero = document.querySelector('header')
    if (hero) observer.observe(hero)
    observer.observe(document.body)
    const timers = [setTimeout(place, 120), setTimeout(place, 600)]
    window.addEventListener('resize', place)
    void document.fonts?.ready.then(place)

    return () => {
      cancelAnimationFrame(frame)
      timers.forEach(clearTimeout)
      observer.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [ref])
}

/**
 * The letter as a page of paper, pulled up so it overlaps the hero — the first
 * thing you read is a letterhead, not a landing page.
 *
 * It sits at z-20: above the envelope's standing flap and below its body, so it can
 * emerge from the envelope as the page scrolls.
 */
export function LetterSheet({ letterHash }: { letterHash: string }) {
  const spacer = useRef<HTMLDivElement | null>(null)
  useStartDepth(spacer)

  const paragraphs = letterText
    .split('\n\n')
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)

  return (
    <div className="relative z-20 mx-auto -mt-28 w-full max-w-5xl px-7 sm:-mt-36 sm:px-6">
      <div ref={spacer} aria-hidden="true" className="h-[420px]" />
      <div className="relative">
        {/* the sheet underneath, so it reads as paper rather than a card */}
        <div
          aria-hidden="true"
          className="absolute inset-0 translate-x-1.5 translate-y-2 rounded-[3px] border border-sheet-rule bg-sheet-back"
        />

        <article className="relative rounded-[3px] border border-sheet-rule bg-sheet px-7 py-10 shadow-[0_2px_4px_rgba(0,0,0,0.5),0_60px_100px_-60px_rgba(0,0,0,0.95)] sm:min-h-[900px] sm:px-20 sm:py-16 lg:px-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-sheet-rule pb-4">
            <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-sheet-ink-faint">
              {page.letterhead.from}
            </span>
            <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-sheet-ink-faint">
              {page.letterhead.date}
            </span>
          </div>

          <div className="mt-6">
            <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-sheet-ink-faint">To</p>
            <p className="mt-1 font-serif text-[0.9375rem] leading-relaxed text-sheet-ink-soft">
              {page.letterhead.to}
            </p>
          </div>

          <p className="mt-6 font-serif text-[1.0625rem] font-semibold leading-snug text-sheet-ink">
            {page.letterhead.subject}
          </p>

          <p className="letter-body mt-7">{page.letterhead.salutation}</p>

          <div className="letter-body mt-5 space-y-5">
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
            ) : (
              <p className="italic text-sheet-ink-faint">{page.emptyLetterNotice}</p>
            )}
          </div>

          <div className="mt-10 border-t border-sheet-rule pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-sheet-ink-faint">
                Signed on the Hedera Consensus Service
              </span>
              <span className="font-mono text-[0.6875rem] text-sheet-ink-faint">{letterHash.slice(0, 16)}…</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
