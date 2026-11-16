import { useEffect, useRef, useState } from 'react'
import { EnvelopeSvg } from './EnvelopeSvg'

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

interface EnvelopeState {
  /** 0 = sealed, 1 = open */
  progress: number
  /** 0 = still in place, 1 = carried fully out of the viewport */
  exit: number
}

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
  const latest = useRef<EnvelopeState>({ progress: 0, exit: 0 })
  const [state, setState] = useState<EnvelopeState>({ progress: 0, exit: 0 })
  const reduced = usePrefersReducedMotion()
  // on a phone the envelope is open before the page moves at all
  const [opensOnScroll, setOpensOnScroll] = useState(() => envelopeOpensOnScroll(window.innerWidth))

  useEffect(() => {
    if (reduced) return

    let frame = 0

    const update = (): void => {
      // the envelope is fixed, so its viewport position never changes — both values
      // are simply how far the page has been scrolled. They start together.
      const progress = clamp01(window.scrollY / REVEAL_DISTANCE)
      const exit = clamp01(window.scrollY / EXIT_DISTANCE)
      // whether there is an opening to watch depends on the viewport's width, and this
      // is the only place a resize is noticed
      setOpensOnScroll(envelopeOpensOnScroll(window.innerWidth))
      const previous = latest.current
      // only re-render when a value actually moves: every render repaints the whole
      // drawing, and scroll fires far more often than a frame
      if (Math.abs(progress - previous.progress) < 0.004 && Math.abs(exit - previous.exit) < 0.004) {
        return
      }
      latest.current = { progress, exit }
      setState({ progress, exit })
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
  }, [reduced])

  const progress = reduced || !opensOnScroll ? 1 : state.progress
  const exit = reduced ? 0 : state.exit
  // from hanging below the edge to sitting entirely below it — body and flap
  const shift = (BODY_HIDDEN + exit * envelopeTravel()) * 100

  const layer = (part: 'back' | 'front', z: string) => (
    <div aria-hidden="true" className={`pointer-events-none fixed inset-x-0 bottom-0 ${z}`}>
      {/* a little air at the sides, at every width: the envelope reaches past the
          letter's edges, but never touches the screen's */}
      <div className="mx-auto w-full max-w-5xl px-3">
        <div
          style={{
            aspectRatio: `${BODY_ASPECT}`,
            transform: `translateY(${shift.toFixed(2)}%)`,
          }}
        >
          <EnvelopeSvg part={part} progress={progress} className="h-full w-full" />
        </div>
      </div>
    </div>
  )

  return (
    <>
      {layer('back', 'z-10')}
      {layer('front', 'z-30')}
    </>
  )
}
