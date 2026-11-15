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

/** How much scrolling the whole unsealing takes, in pixels. */
const REVEAL_DISTANCE = 420
/** How far the envelope travels down while it unseals. */
const TRAVEL_DISTANCE = 340

/**
 * The envelope, sitting over the letterhead and driven by scroll.
 *
 * Step 1 of the reveal: it is one drawn object (EnvelopeSvg) rather than a stack
 * of divs, so the fold seams, the pocket and the flap read as an envelope at any
 * size. The scroll behaviour is unchanged for now.
 */
export function EnvelopeOverlay() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [progress, setProgress] = useState(0)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (reduced) return

    let frame = 0

    const update = (): void => {
      const element = ref.current
      if (!element) return
      const top = element.getBoundingClientRect().top + window.scrollY
      // begin as the envelope comes up the viewport, finish a fixed 420px later
      // so the reveal completes on any page length, however short
      const start = top - window.innerHeight * 0.45
      setProgress(clamp01((window.scrollY - start) / REVEAL_DISTANCE))
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

  if (reduced) return null

  const flapOpen = clamp01(progress / 0.32)
  const travel = progress * TRAVEL_DISTANCE
  const opacity = progress < 0.78 ? 1 : clamp01(1 - (progress - 0.78) / 0.22)

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-20 aspect-[3/2] w-full"
      style={{
        transform: `translate3d(0, ${travel.toFixed(1)}px, 0)`,
        opacity,
        willChange: 'transform, opacity',
        filter: 'drop-shadow(0 28px 38px rgba(0, 0, 0, 0.55))',
      }}
    >
      <EnvelopeSvg flapOpen={flapOpen} className="h-full w-full" />
    </div>
  )
}
