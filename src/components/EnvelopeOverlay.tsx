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

/** How much scrolling opens the envelope, in pixels. Short on purpose: the
 *  envelope is anchored to the sheet, so it leaves the viewport as you scroll —
 *  the reveal has to finish while the standing flap is still on screen. */
const REVEAL_DISTANCE = 150

/**
 * The envelope on the letter sheet. It is placed so the body's top edge sits on
 * the sheet's top edge and the standing flap reaches up over the hero — the
 * drawing's fold is at y = 256 of 640, hence the -40% lift.
 *
 * The only animated value is progress: the flap mirrors about the fold as the
 * reader scrolls, and everything the flap hides changes with it.
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
      const element = ref.current
      if (!element) return
      // the element is lifted by 40% of its height so the body sits on the sheet;
      // add that back to get the position the scroll is measured against
      const untransformedTop =
        element.getBoundingClientRect().top + window.scrollY + 0.4 * element.offsetHeight
      // open over a fixed distance, starting once the sheet is comfortably in view
      const start = Math.max(0, untransformedTop - window.innerHeight * 0.55)
      const next = clamp01((window.scrollY - start) / REVEAL_DISTANCE)
      // only re-render when the value actually moves; a scroll event fires far more
      // often than a frame, and every render repaints the whole drawing
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
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-20 aspect-square"
      style={{ transform: 'translateY(-40%)' }}
    >
      <EnvelopeSvg progress={reduced ? 1 : progress} className="h-full w-full" />
    </div>
  )
}
