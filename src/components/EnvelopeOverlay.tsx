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

/** How much scrolling opens the envelope, in pixels. */
const REVEAL_DISTANCE = 420
/** How much scrolling then carries the opened envelope out of the viewport.
 *  Short enough that the drift completes on a short page too. */
const EXIT_DISTANCE = 260

/** The body's proportions: 588 × 363 of the drawing's units. */
const BODY_ASPECT = 588 / 363

/** How much of the body stays below the viewport's bottom edge while the envelope
 *  is still closed. It hangs out of the frame from the start, as it always did. */
const BODY_HIDDEN = 0.32

interface EnvelopeState {
  /** 0 = sealed, 1 = open */
  progress: number
  /** 0 = still in place, 1 = carried fully out of the viewport */
  exit: number
}

/**
 * The envelope, pinned to the bottom edge of the viewport.
 *
 * It does not travel with the page: its bottom edge sits on the viewport's bottom
 * edge and stays there, so the reveal plays out in a stable frame while the letter
 * scrolls behind it. Only the flap moves — a single progress value, driven by the
 * scroll position.
 *
 * Once it is fully open, further scrolling carries it out of the viewport and fades
 * it away, so it stops covering the letter.
 *
 * The drawing's viewBox is the body alone; the standing flap and the drop shadow
 * reach above it through `overflow: visible`.
 */
export function EnvelopeOverlay() {
  const ref = useRef<HTMLDivElement | null>(null)
  const latest = useRef<EnvelopeState>({ progress: 0, exit: 0 })
  const [state, setState] = useState<EnvelopeState>({ progress: 0, exit: 0 })
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (reduced) return

    let frame = 0

    const update = (): void => {
      // the envelope is fixed, so its viewport position never changes — both values
      // are simply how far the page has been scrolled
      const progress = clamp01(window.scrollY / REVEAL_DISTANCE)
      const exit = clamp01((window.scrollY - REVEAL_DISTANCE) / EXIT_DISTANCE)
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

  const exit = reduced ? 0 : state.exit
  // from hanging 32% below the edge to sitting entirely below it: one body height
  const shift = (BODY_HIDDEN + exit * (1 - BODY_HIDDEN)) * 100

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <div
          ref={ref}
          style={{
            aspectRatio: `${BODY_ASPECT}`,
            transform: `translateY(${shift.toFixed(2)}%)`,
            opacity: (1 - exit).toFixed(3),
          }}
        >
          <EnvelopeSvg progress={reduced ? 1 : state.progress} className="h-full w-full" />
        </div>
      </div>
    </div>
  )
}
