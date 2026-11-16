import { useLayoutEffect, useRef } from 'react'
import { page } from '../content/page'
import { ENVELOPE, envelopeOpensOnScroll, envelopeTravel } from './EnvelopeOverlay'
import { letterText } from 'virtual:letter'

/** How far through the flap's travel the paper should reach the fold. */
const CROSSING = 0.62
/** On a phone the envelope is already open, so there is no crossing to aim for: the
 *  paper stands out of the opening, its letterhead — the From line — clear of the fold.
 *  Negative: it starts above the fold, not inside it. */
const OPEN_DEPTH = -0.5

/**
 * The sheet starts inside the envelope, not at its opening: the gap above it is the
 * distance it travels to come out, and the envelope covers it until the page scrolls.
 *
 * That distance cannot be a fixed number of pixels — the envelope's height follows the
 * viewport (588:363), and the fold sits a fixed fraction of it above the bottom edge.
 * So the gap is measured: place the paper where it is `CROSSING` of the reveal away
 * from meeting the fold — or, where the envelope starts open, a little inside it.
 */
function useStartDepth(
  wrapper: React.RefObject<HTMLDivElement | null>,
  sheet: React.RefObject<HTMLDivElement | null>,
): void {
  useLayoutEffect(() => {
    const place = (): void => {
      const box = wrapper.current
      const paper = sheet.current
      // measured, not derived: iOS Safari anchors a fixed element differently from what
      // `innerHeight` reports, and the paper has to sit where the envelope actually is
      const envelope = document.querySelector<HTMLElement>('[data-envelope="front"]')
      if (!box || !paper || !envelope) return

      const rect = envelope.getBoundingClientRect()
      const bodyHeight = rect.height
      // the fold has already descended by however far the page is scrolled; the paper
      // is placed against where it sits with the page at rest
      const exit = Math.min(1, Math.max(0, window.scrollY / ENVELOPE.exit))
      const fold = rect.top + window.scrollY - exit * envelopeTravel() * bodyHeight
      // how far the fold itself descends per pixel of scroll
      const foldPerScroll = (envelopeTravel() / ENVELOPE.exit) * bodyHeight
      const depth = envelopeOpensOnScroll(window.innerWidth)
        ? CROSSING * ENVELOPE.reveal * (1 + foldPerScroll)
        : OPEN_DEPTH * bodyHeight
      const target = fold + depth

      // a margin, not a spacer: on a phone the paper starts above the wrapper's top edge
      const top = box.getBoundingClientRect().top + window.scrollY
      paper.style.marginTop = `${Math.round(target - top)}px`
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
  }, [wrapper, sheet])
}

/**
 * The letter as a page of paper, pulled up so it overlaps the hero — the first
 * thing you read is a letterhead, not a landing page.
 *
 * It sits at z-20: above the envelope's standing flap and below its body, so it can
 * emerge from the envelope as the page scrolls.
 */
export function LetterSheet({ letterHash }: { letterHash: string }) {
  const wrapper = useRef<HTMLDivElement | null>(null)
  const sheet = useRef<HTMLDivElement | null>(null)
  useStartDepth(wrapper, sheet)

  const paragraphs = letterText
    .split('\n\n')
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)

  return (
    <div ref={wrapper} className="relative z-20 mx-auto -mt-28 flow-root w-full max-w-5xl px-7 sm:-mt-36 sm:px-6">
      <div ref={sheet} className="relative">
        {/* the sheet underneath, so it reads as paper rather than a card */}
        <div
          aria-hidden="true"
          className="absolute inset-0 translate-x-1.5 translate-y-2 rounded-[3px] border border-sheet-rule bg-sheet-back"
        />

        <article className="relative rounded-[3px] border border-sheet-rule bg-sheet px-7 py-10 shadow-[0_2px_4px_rgba(0,0,0,0.5),0_60px_100px_-60px_rgba(0,0,0,0.95)] sm:min-h-[900px] sm:px-20 sm:py-16 lg:px-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-sheet-rule pb-4">
            <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-sheet-ink-faint">
              {/* the same words as on the envelope's flap */}
              {page.from.name}
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
