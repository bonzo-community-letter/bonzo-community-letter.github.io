import { useEffect, useRef } from 'react'
import { testimonials, type Signature } from '../lib/hcs'
import { signedWhen } from '../lib/format'
import { copiesFor, nextOffset } from '../lib/band'

/** Pixels per second the band drifts on its own. Slow enough to read along. */
const SPEED = 26
/** After the reader lets go, how long before it drifts again. */
const RESUME_AFTER = 2600

/**
 * What signers wrote, as one band that never ends.
 *
 * One entry per account — the first comment that account left, since a second signature
 * is ignored by the count and would only repeat the first. Accounts that wrote nothing
 * are not here: a comment needs words.
 *
 * The band is a plain horizontally scrollable strip. It drifts by itself; the reader can
 * scroll it with a trackpad or a wheel, drag it with a mouse, or stop on a comment and
 * read — it holds still while hovered or focused, and starts again a moment after they
 * let go. It never shows an edge: the same set is laid out more than once, and when the
 * strip has moved by exactly one set it is rewound by that much, which is invisible
 * because the next copy is identical. With `prefers-reduced-motion` it does not drift at
 * all; scrolling still works.
 */
export function Testimonials({
  signatures,
  sample = false,
}: {
  signatures: readonly Signature[]
  /** `?demo=1`: the entries include invented comments, and the section says so. */
  sample?: boolean
}) {
  const entries = testimonials(signatures)

  const strip = useRef<HTMLDivElement | null>(null)
  const firstCopy = useRef<HTMLUListElement | null>(null)
  const dragging = useRef<{ x: number; left: number } | null>(null)
  const resumeAt = useRef(0)
  const holding = useRef(false)
  // The drift is kept as a float here, not read back from the element: a browser may
  // round `scrollLeft` to whole pixels, and 26 px/s in 16 ms steps is less than one.
  const offset = useRef(0)

  // One set has to be wider than the window, or the band would show where it repeats.
  const copies = copiesFor(entries.length)

  useEffect(() => {
    const el = strip.current
    if (!el || entries.length === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    let last = performance.now()

    const step = (now: number) => {
      const elapsed = Math.min(now - last, 64) // a backgrounded tab must not jump
      last = now
      const width = firstCopy.current?.offsetWidth ?? 0
      const paused = holding.current || dragging.current !== null || now < resumeAt.current
      if (paused) {
        // the reader moved it; start from where they left it
        offset.current = el.scrollLeft
      } else if (width > 0) {
        offset.current = nextOffset(offset.current, width, SPEED, elapsed)
        el.scrollLeft = offset.current
      }
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [entries.length])

  if (entries.length === 0) return null

  // Dragging with a mouse: horizontal scrolling otherwise needs a trackpad.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = strip.current
    if (!el || event.pointerType === 'touch') return
    dragging.current = { x: event.clientX, left: el.scrollLeft }
    // A drag that ends outside the strip still ends: without this the band would stay
    // paused for good after a press that was released over the footer.
    window.addEventListener('pointerup', endDrag, { once: true })
    window.addEventListener('pointercancel', endDrag, { once: true })
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = strip.current
    const state = dragging.current
    if (!el || !state) return
    el.scrollLeft = state.left - (event.clientX - state.x)
  }

  const endDrag = () => {
    if (!dragging.current) return
    dragging.current = null
    resumeAt.current = performance.now() + RESUME_AFTER
  }

  const hold = () => {
    resumeAt.current = performance.now() + RESUME_AFTER
  }

  return (
    // The wall runs behind the whole page; behind a wall of text it has to step back,
    // the same way the hero's own tint does.
    <section className="border-y border-rule/40 bg-page/88 pb-16 pt-16 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <p className="eyebrow">Comments</p>
        <h2 className="mt-2 font-serif text-2xl leading-tight text-ink">
          {sample ? 'Sample comments — not signatures' : 'Personal Messages from the Signees'}
        </h2>
      </div>

      <div
        className="relative"
        style={{
          maskImage: 'linear-gradient(to right, transparent, #000 14%, #000 86%, transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, #000 14%, #000 86%, transparent)',
        }}
      >
        <div
          ref={strip}
        role="group"
        aria-label="Comments from signers — scrolls on its own, and can be scrolled"
        tabIndex={0}
        onMouseEnter={() => {
          holding.current = true
        }}
        onMouseLeave={() => {
          holding.current = false
          hold()
        }}
        onWheel={hold}
        onTouchStart={hold}
        onFocus={() => {
          holding.current = true
        }}
        onBlur={() => {
          holding.current = false
        }}
        onKeyDown={(event) => {
          hold()
          if (event.key === 'ArrowRight') strip.current?.scrollBy({ left: 320 })
          if (event.key === 'ArrowLeft') strip.current?.scrollBy({ left: -320 })
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="mt-7 cursor-grab touch-pan-x overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden active:cursor-grabbing"
        style={{ scrollBehavior: 'auto' }}
      >
        <div className="flex w-max">
          {Array.from({ length: copies }, (_, copy) => (
            <ul
              key={copy}
              ref={copy === 0 ? firstCopy : undefined}
              aria-hidden={copy > 0 ? true : undefined}
              className="flex shrink-0 select-none"
            >
              {entries.map((entry) => (
                <li
                  key={`${copy}-${entry.accountId}`}
                  className="flex w-[19rem] shrink-0 flex-col border-l border-rule/70 px-6 py-1 sm:w-[23rem] sm:px-8"
                >
                  {/* A band is a strip, not a page: the longest comment is cut at six lines
                      and says so with an ellipsis. The full text is the topic's, and the
                      title attribute carries it for a reader who wants the rest. */}
                  <blockquote
                    title={entry.comment}
                    className="line-clamp-6 font-serif text-[1rem] leading-relaxed text-ink"
                  >
                    {entry.comment}
                  </blockquote>
                  <p className="mt-auto flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-3 font-mono text-[0.625rem] text-ink-faint">
                    <span className="whitespace-nowrap">{entry.accountId}</span>
                    <span aria-hidden="true">·</span>
                    <span className="whitespace-nowrap">{signedWhen(entry.signedAt, { time: false })}</span>
                  </p>
                </li>
              ))}
            </ul>
          ))}
          </div>
        </div>
      </div>
    </section>
  )
}
