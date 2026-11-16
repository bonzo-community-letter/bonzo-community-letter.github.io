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

/** The body's proportions: 588 × 363 of the drawing's units. */
const BODY_ASPECT = 588 / 363

/** How much of the body stays below the viewport's bottom edge. The envelope
 *  hangs out of the frame as it did when it was anchored to the sheet; pinning it
 *  must not lift it into full view. */
const BODY_HIDDEN = 0.32

/**
 * The envelope, pinned to the bottom edge of the viewport.
 *
 * It does not travel with the page: its bottom edge sits on the viewport's bottom
 * edge and stays there, so the reveal plays out in a stable frame while the letter
 * scrolls behind it. Only the flap moves — a single progress value, driven by the
 * scroll position.
 *
 * The drawing's viewBox is the body alone; the standing flap and the drop shadow
 * reach above it through `overflow: visible`.
 */
export function EnvelopeOverlay() {
  const ref = useRef<HTMLDivElement | null>(null)
  const latest = useRef(0)
  const [progress, setProgress] = useState(0)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (reduced) return

    let frame = 0

    const update = (): void => {
      // the envelope is fixed, so its viewport position never changes — the reveal
      // is simply how far the page has been scrolled
      const next = clamp01(window.scrollY / REVEAL_DISTANCE)
      // only re-render when the value actually moves: every render repaints the
      // whole drawing, and scroll fires far more often than a frame
      if (Math.abs(next - latest.current) < 0.004) return
      latest.current = next
      setProgress(next)
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

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <div
          ref={ref}
          style={{
            aspectRatio: `${BODY_ASPECT}`,
            transform: `translateY(${(BODY_HIDDEN * 100).toFixed(1)}%)`,
          }}
        >
          <EnvelopeSvg progress={reduced ? 1 : progress} className="h-full w-full" />
        </div>
      </div>
    </div>
  )
}
