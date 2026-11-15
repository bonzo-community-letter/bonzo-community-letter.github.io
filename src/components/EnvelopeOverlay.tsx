import { useEffect, useRef, useState } from 'react'

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
 * A sealed envelope covering the letterhead. As the page scrolls it unseals and
 * travels down out of the way, so the letter appears to slide out of it.
 *
 * Scroll-driven rather than timeline-driven: nothing moves on its own, the
 * envelope follows the reader's scroll, and with `prefers-reduced-motion` it is
 * not rendered at all — the letterhead is simply visible.
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

  const flap = clamp01(progress / 0.32) * -172
  const travel = progress * TRAVEL_DISTANCE
  const opacity = progress < 0.78 ? 1 : clamp01(1 - (progress - 0.78) / 0.22)
  const tilt = progress * -1.4

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-20 -mx-1.5 h-[220px] [perspective:1200px] sm:h-[264px]"
      style={{
        transform: `translate3d(0, ${travel.toFixed(1)}px, 0) rotate(${tilt.toFixed(2)}deg)`,
        opacity,
        willChange: 'transform, opacity',
      }}
    >
      {/* envelope body */}
      <div className="absolute inset-0 rounded-[3px] border border-[#d5cab7] bg-[#efe7d9] shadow-[0_18px_40px_-26px_rgba(0,0,0,0.9)]" />

      {/* pocket front: a V-shaped top edge, so the paper reads as an envelope */}
      <div
        className="absolute inset-x-0 bottom-0 h-[64%] rounded-b-[3px] border-b border-x border-[#d5cab7] bg-[#e8dfce]"
        style={{ clipPath: 'polygon(0 0, 50% 44%, 100% 0, 100% 100%, 0 100%)' }}
      />

      {/* the flap, hinged at the top edge; once it has swung past vertical it
          sits behind the body, the way an opened flap does */}
      <div
        className="absolute inset-x-0 top-0 h-[56%] origin-top transition-none"
        style={{
          transform: `rotateX(${flap.toFixed(2)}deg)`,
          transformStyle: 'preserve-3d',
          zIndex: flap < -90 ? -1 : 3,
        }}
      >
        <div
          className="h-full w-full bg-[#f7f1e4]"
          style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
        />
      </div>

      {/* a hairline where the flap meets the pocket */}
      <div className="absolute inset-x-0 top-[56%] h-px bg-[#d5cab7]/70" />
    </div>
  )
}
