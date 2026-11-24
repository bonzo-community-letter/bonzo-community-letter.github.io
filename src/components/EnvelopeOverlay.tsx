import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ENVELOPE_VIEW, EnvelopeSvg } from './EnvelopeSvg'

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent): void => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/** How much scrolling opens the envelope, in pixels. Short, so the flap is well up
 *  by the time the paper reaches the fold: the two cross at about two thirds of the
 *  flap's travel. */
const REVEAL_DISTANCE = 240
/** How much scrolling carries the envelope out of the viewport. It starts together
 *  with the reveal — the envelope sinks while its flap is still coming up. */
const EXIT_DISTANCE = 700

/** The body's proportions: 588 × 363 of the drawing's units. */
const BODY_ASPECT = 588 / 363

/** How much of the body stays below the viewport's bottom edge while the envelope
 *  is still closed. It hangs out of the frame from the start, as it always did. */
const BODY_HIDDEN = 0.32

/** Air kept between the hero's last line and anything drawn over the page. */
export const HERO_CLEARANCE = 28

export const envelopeHidden = (): number => BODY_HIDDEN

/** On a phone there is no room to watch an envelope open: the hero fills the screen
 *  and the body is only ~230px tall. There it starts open — the flap stands up into
 *  the hero — and scrolling only carries it away. */
export const envelopeOpensOnScroll = (viewportWidth: number): boolean => viewportWidth >= 640

/** Side breathing room for the envelope, so it never sits flush against the screen
 *  edge. Matches the overlay's `px-3`. */
const GUTTER = 12

export const envelopeGutter = (): number => GUTTER

/** The standing flap reaches 223 of the body's 363 units above the fold, so the
 *  envelope is not out of the frame until that much more has passed the bottom edge. */
const FLAP_UP = 223 / 363

/** The whole way out, in body heights: the part still in view, then the flap above it.
 *  It depends on how much of the body hangs below the edge to begin with. */
export const envelopeTravel = (): number => 1 - BODY_HIDDEN + FLAP_UP + 0.04

/** The envelope's choreography in one place. The letter needs the same numbers to
 *  know where it should start: the envelope's size follows the viewport, so the
 *  distance the paper sits inside it cannot be a fixed number of pixels. */
export const ENVELOPE = {
  /** body width ÷ height */
  aspect: BODY_ASPECT,
  /** scroll distances */
  reveal: REVEAL_DISTANCE,
  exit: EXIT_DISTANCE,
  /** the drawing's widest, matching the overlay's `max-w-5xl` */
  maxWidth: 1024,
} as const

/**
 * The envelope, pinned to the bottom edge of the viewport — in two layers, with the
 * letter between them.
 *
 * The letter is real HTML in the document flow. It has to emerge in front of the
 * standing flap and behind the body, which is only possible if the drawing is split:
 * `back` holds the standing flap at z-10, `front` holds the body at z-30, and the
 * sheet sits at z-20. Both layers are fixed to the same box, so they move together.
 *
 * Once open, the envelope is carried down and out of the viewport so it stops
 * covering the letter.
 */
export function EnvelopeOverlay() {
  const front = useRef<HTMLDivElement | null>(null)
  const back = useRef<HTMLDivElement | null>(null)
  const shadow = useRef<HTMLDivElement | null>(null)
  const placed = useRef({ width: 0, top: 0, push: 0, heroBottom: -1, boxHeight: 0, shiftPx: 0 })
  const opensOnScrollAtMount = useRef(envelopeOpensOnScroll(window.innerWidth))
  const latest = useRef({ progress: opensOnScrollAtMount.current ? 0 : 1, exit: 0, lifted: !opensOnScrollAtMount.current })
  // on a phone the envelope is open from the first paint, so the flap is already up
  const [lifted, setLifted] = useState(() => !opensOnScrollAtMount.current)
  const reduced = usePrefersReducedMotion()
  const [opensOnScroll, setOpensOnScroll] = useState(opensOnScrollAtMount.current)

  useLayoutEffect(() => {
    // written straight onto the elements: a React render per frame repaints both
    // drawings and their filters, which an iPhone cannot keep up with
    let flapEl: SVGGElement | null = null
    /** Where the hero's own text ends — the line nothing may be painted over. */
    const heroTextBottom = (): number => {
      const hero = document.querySelector<HTMLElement>('header.hero-height')
      if (!hero) return -1
      const lines = Array.from(hero.querySelectorAll<HTMLElement>('h1, p, ul, .eyebrow-mark')).filter(
        (el) => !el.classList.contains('sr-only') && el.getBoundingClientRect().height > 4,
      )
      return lines.length > 0
        ? Math.round(Math.max(...lines.map((el) => el.getBoundingClientRect().bottom)))
        : -1
    }

    const place = (): void => {
      const box = front.current
      if (!box) return
      const width = window.innerWidth
      // the box's top before the drift transform, which then carries it down; the box
      // reaches from the open flap's tip to the body's bottom, so placing its bottom on
      // the viewport's edge leaves the body hanging out by the same amount as before
      const boxHeight = box.offsetHeight
      const top = Math.round(window.innerHeight - boxHeight)
      const shiftPx = BODY_HIDDEN * ENVELOPE_VIEW.bodyShare * boxHeight

      // The open flap stands up into the page and is painted above the hero, so its tip
      // must clear the hero's own text. On a narrow screen the address list is taller than
      // the space the viewport leaves above the tip, and the flap covered the last lines.
      // The fix is one constant offset, applied with the drift: the envelope's bottom edge
      // already hangs below the viewport, so a little more of the body costs nothing.
      const heroBottom = heroTextBottom()
      const wanted = heroBottom >= 0 ? heroBottom + HERO_CLEARANCE : -Infinity
      // What the envelope actually paints at its top. With the flap open — a phone, where
      // it is open from the first paint — that is the box's own top edge, the tip of the
      // standing flap. With the flap closed — a wide screen before any scroll — the box's
      // upper part is the empty space the flap will stand in, and the first painted edge
      // is the body's top.
      const paintedTop =
        top + shiftPx + (latest.current.lifted ? 0 : ENVELOPE_VIEW.bodyTopShare * boxHeight)
      const push = Math.max(0, Math.ceil(wanted - paintedTop))

      placed.current = { width, top, push, heroBottom, boxHeight, shiftPx }
      box.style.marginTop = `${top}px`
      if (back.current) back.current.style.marginTop = `${top}px`
      // the body's shadow on the page: a box shadow, not an SVG filter, which iOS
      // re-rasterises while the layer moves. It sits on the body's own rectangle behind
      // the letter — on the box it would outline the empty space the flap opens into,
      // and on the front layer it would fall across the fold onto the paper.
      const scale = box.offsetWidth / ENVELOPE_VIEW.width
      if (shadow.current) {
        shadow.current.style.boxShadow =
          `0 ${Math.round(14 * scale)}px ${Math.round(32 * scale)}px rgba(0, 0, 0, 0.55)`
      }
    }

    const apply = (): void => {
      const { progress, exit } = latest.current

      // The fold's height above the bottom edge is measured once per width and then kept:
      // re-deriving it whenever the address bar moves is what made the drift stutter. The
      // hero is measured with it, and re-measured when the fonts land or the hero resizes —
      // a first reading taken before the stylesheet settles must not stick.
      const width = window.innerWidth
      const heroBottom = heroTextBottom()
      const stale = placed.current.width !== width || Math.abs(heroBottom - placed.current.heroBottom) > 1
      if (stale || placed.current.boxHeight === 0) place()

      // in body heights, then as a share of the taller box — plus the constant offset that
      // keeps the flap off the hero's text
      const shiftPx =
        (BODY_HIDDEN + exit * envelopeTravel()) * ENVELOPE_VIEW.bodyShare * placed.current.boxHeight
      const transform = `translateY(${(shiftPx + placed.current.push).toFixed(2)}px)`

      if (front.current) front.current.style.transform = transform
      if (back.current) back.current.style.transform = transform

      // the flap element is replaced when it changes layers, so the cache is checked
      if (!flapEl || !flapEl.isConnected) flapEl = document.querySelector<SVGGElement>('[data-flap]')
      if (flapEl) {
        flapEl.setAttribute(
          'transform',
          `translate(0 ${(2 * 256 * progress).toFixed(2)}) scale(1 ${(1 - 2 * progress).toFixed(4)})`,
        )
      }

      // the flap changes sides once, when it passes vertical: that is the only thing
      // React has to be asked about again
      const nowLifted = progress >= 0.5
      if (nowLifted !== latest.current.lifted) {
        latest.current.lifted = nowLifted
        setLifted(nowLifted)
      }
    }

    if (reduced) {
      latest.current = { progress: 1, exit: 0, lifted: true }
      apply()
      return
    }

    const update = (): void => {
      // the envelope is fixed, so its viewport position never changes — both values
      // are simply how far the page has been scrolled. They start together.
      const scroll = window.scrollY
      const opens = envelopeOpensOnScroll(window.innerWidth)
      latest.current.progress = opens ? clamp01(scroll / REVEAL_DISTANCE) : 1
      latest.current.exit = clamp01(scroll / EXIT_DISTANCE)
      if (opens !== opensOnScroll) setOpensOnScroll(opens)
      apply()
    }

    // A frame loop, not a scroll listener: iOS delivers scroll events late and coalesced
    // while the page is coasting, so the page moved smoothly and the envelope trailed it.
    // Reading scrollY once per frame keeps the two in step.
    let frame = 0
    let idle = 0
    let running = false

    const tick = (): void => {
      const before = window.scrollY
      update()
      if (window.scrollY === before) {
        idle += 1
        if (idle > 12) {
          // a fifth of a second without movement: stop until the next scroll
          running = false
          return
        }
      } else {
        idle = 0
      }
      frame = requestAnimationFrame(tick)
    }

    const start = (): void => {
      if (running) return
      running = true
      idle = 0
      frame = requestAnimationFrame(tick)
    }

    const onScroll = (): void => start()
    const onResize = (): void => {
      update()
      start()
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)

    // The hero's height is an input, so it is watched: a late font, a wrapped title or a
    // seventh addressee must move the envelope with it, not leave a stale placement.
    const observer = new ResizeObserver(() => {
      place()
      apply()
    })
    const hero = document.querySelector('header.hero-height')
    if (hero) observer.observe(hero)
    void document.fonts?.ready.then(() => {
      place()
      apply()
    })
    // The hero's box is min-height-driven: its *text* can settle later (fonts, a wrapped
    // title) without the box resizing, so the observer above may never fire. Re-place on
    // the same schedule the paper uses, then leave it alone.
    const timers = [
      setTimeout(() => {
        place()
        apply()
      }, 120),
      setTimeout(() => {
        place()
        apply()
      }, 600),
    ]

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      observer.disconnect()
      timers.forEach(clearTimeout)
      cancelAnimationFrame(frame)
    }
  }, [reduced, opensOnScroll])

  const layer = (part: 'back' | 'front', z: string) => (
    /* Anchored from the top with a measured offset, not to the bottom edge: iOS keeps a
       fixed element inside the *visible* area, so a bottom-anchored envelope moved with
       the address bar every time it collapsed — that is what made the drift stutter. */
    <div aria-hidden="true" className={`pointer-events-none fixed inset-x-0 top-0 ${z}`}>
      {/* a little air at the sides, at every width: the envelope reaches past the
          letter's edges, but never touches the screen's */}
      <div className="relative mx-auto w-full max-w-5xl px-3">
        <div
          ref={part === 'front' ? front : back}
          data-envelope={part}
          className="relative"
          style={{
            aspectRatio: `${ENVELOPE_VIEW.width} / ${ENVELOPE_VIEW.height}`,
            marginBottom: '0',
            transform: `translateY(${(BODY_HIDDEN * ENVELOPE_VIEW.bodyShare * 100).toFixed(2)}%)`,
            willChange: 'transform',
          }}
        >
          <EnvelopeSvg part={part} progress={latest.current.progress} lifted={lifted} className="h-full w-full" />
          {/* the body's shadow, on the body's own rectangle: the box is taller than the
              body now, so a shadow on it would outline the space the flap opens into */}
          {part === 'back' ? (
            <div
              ref={shadow}
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0"
              style={{ top: `${(ENVELOPE_VIEW.bodyTopShare * 100).toFixed(3)}%` }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {layer('back', 'z-10')}
      {layer('front', 'z-30')}
      {/* iOS Safari stops a fixed element at the bottom bar, so the envelope cannot reach
          behind it — but an element that touches the bar tints it with its own background
          colour. Only a touch device has that bar; on a desktop the strip would just be a
          dark band across the envelope's foot. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-30 toolbar-tint">
        <div className="mx-auto w-full max-w-5xl px-3">
          <div className="h-2 bg-page" />
        </div>
      </div>
    </>
  )
}
