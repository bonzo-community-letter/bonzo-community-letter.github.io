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
  const placed = useRef({ width: 0, top: 0 })
  const opensOnScrollAtMount = useRef(envelopeOpensOnScroll(window.innerWidth))
  const latest = useRef({ progress: opensOnScrollAtMount.current ? 0 : 1, exit: 0, lifted: !opensOnScrollAtMount.current })
  // on a phone the envelope is open from the first paint, so the flap is already up
  const [lifted, setLifted] = useState(() => !opensOnScrollAtMount.current)
  const reduced = usePrefersReducedMotion()
  const [opensOnScroll, setOpensOnScroll] = useState(opensOnScrollAtMount.current)

  useLayoutEffect(() => {
    // written straight onto the elements: a React render per frame repaints both
    // drawings and their filters, which an iPhone cannot keep up with
    const apply = (): void => {
      const { progress, exit } = latest.current
      // in body heights, then as a share of the taller box
      const shift = (BODY_HIDDEN + exit * envelopeTravel()) * ENVELOPE_VIEW.bodyShare * 100
      const transform = `translateY(${shift.toFixed(2)}%)`

      // the fold's height above the bottom edge, measured once per width and then kept:
      // re-deriving it whenever the address bar moves is what made the drift stutter
      const width = window.innerWidth
      if (placed.current.width !== width && front.current) {
        const bodyHeight = front.current.offsetWidth / ENVELOPE.aspect
        placed.current = {
          width,
          // the box's top before the drift transform, which then carries it down
          top: Math.round(window.innerHeight - bodyHeight),
        }
        if (front.current) front.current.style.marginTop = `${placed.current.top}px`
        if (back.current) back.current.style.marginTop = `${placed.current.top}px`
        // the body's shadow on the page: a box shadow, not an SVG filter, which iOS
        // re-rasterises while the layer moves
        const scale = front.current.offsetWidth / ENVELOPE_VIEW.width
        const shadow = `0 ${Math.round(14 * scale)}px ${Math.round(32 * scale)}px rgba(0, 0, 0, 0.55)`
        if (front.current) front.current.style.boxShadow = shadow
      }

      if (front.current) front.current.style.transform = transform
      if (back.current) back.current.style.transform = transform

      const flap = document.querySelector<SVGGElement>('[data-flap]')
      if (flap) {
        flap.setAttribute(
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

    let frame = 0

    const update = (): void => {
      // the envelope is fixed, so its viewport position never changes — both values
      // are simply how far the page has been scrolled. They start together.
      const scroll = window.scrollY
      const onScroll = envelopeOpensOnScroll(window.innerWidth)
      latest.current.progress = onScroll ? clamp01(scroll / REVEAL_DISTANCE) : 1
      latest.current.exit = clamp01(scroll / EXIT_DISTANCE)
      if (onScroll !== opensOnScroll) setOpensOnScroll(onScroll)
      apply()
    }

    const onScroll = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
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
            marginBottom: `-${(ENVELOPE_VIEW.skirtOfWidth * 100).toFixed(3)}%`,
            transform: `translateY(${(BODY_HIDDEN * ENVELOPE_VIEW.bodyShare * 100).toFixed(2)}%)`,
            willChange: 'transform',
          }}
        >
          <EnvelopeSvg part={part} progress={latest.current.progress} lifted={lifted} className="h-full w-full" />
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
          colour. Dark, the bar reads as part of the page rather than as paper. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto w-full max-w-5xl px-3">
          <div className="h-2 bg-page" />
        </div>
      </div>
    </>
  )
}
