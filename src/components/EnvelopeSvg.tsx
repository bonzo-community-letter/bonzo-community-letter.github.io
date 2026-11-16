/**
 * The envelope, drawn once and opened by a single value — in two parts.
 *
 * The letter is real HTML and has to pass between them: it must come out in front
 * of the standing flap and behind the body. So the drawing is split:
 *
 *   part="back"  — the standing flap, painted *behind* the letter
 *   part="front" — the body, its flaps, the contour, painted *in front* of it
 *
 * While the envelope is still closed the flap lies on top of the body, so it is
 * painted with the front part; it changes sides at the moment it passes vertical,
 * where it is edge-on and the swap cannot be seen.
 *
 * progress 0 = sealed, 1 = open. The flap is one triangle whose tip sits 223 units
 * below the fold when shut and 223 above it when open, so mirroring it about the
 * fold is the whole motion, and the inside is uncovered underneath it.
 */

interface EnvelopeSvgProps {
  /** 0 = sealed, 1 = open */
  progress?: number
  /** which half of the drawing to render */
  part?: 'back' | 'front'
  className?: string
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/* ── geometry, measured off the approved drawings ─────────────────────────── */
const BODY = { x: 26, y: 256, w: 588, h: 363 }
const HINGE = 256
const FLAP_TIP = 479 // 223 below the hinge; mirrored, it is 223 above
const FLAP = `M33 ${HINGE} L607 ${HINGE} L320 ${FLAP_TIP} Z`
const FLAP_EDGE = `M33 ${HINGE} L320 ${FLAP_TIP} L607 ${HINGE}`
const FLAP_SHADOW = `M33 ${HINGE + 3} L320 ${FLAP_TIP + 3} L607 ${HINGE + 3}`
/** The inside is exactly the area the flap covers, so nothing of it shows while sealed. */
const INTERIOR = FLAP
const POCKET =
  'M26 619 L290.2 452.75 C290.2 452.75 308.26 443 320 443 C331.78 443 349.91 452.82 349.91 452.82 L614 619 Z'
const SIDE_LEFT = 'M26 619 L290 453 C290 453 138 321 57 261 C50 256 26 256 26 256 Z'
const SIDE_RIGHT = 'M614 619 L350 453 C350 453 502 321 583 261 C590 256 614 256 614 256 Z'
const SIDE_EDGE_LEFT = 'M26 256 C26 256 50 256 57 261 C138 321 290 453 290 453'
const SIDE_EDGE_RIGHT = 'M614 256 C614 256 590 256 583 261 C502 321 350 453 350 453'
/** The glued margin, in the flap's own (closed) coordinate space: the group's mirror
 *  about y = 256 turns it into the approved open-state path. */
const STRIP_LOCAL = 'M31.81 248.51 L320.5 479 L608 249'
const OUTLINE =
  'M26 257 L26 612 C26 615.87 29.13 619 33 619 L607 619 C610.13 619 614 615.87 614 612 L614 257'
/** The body's silhouette: square at the fold, rounded at the bottom. */
const CLIP =
  'M26 256 L614 256 L614 612 C614 615.87 610.87 619 607 619 L33 619 C29.13 619 26 615.87 26 612 Z'

/** A soft edge without a blur filter: three strokes, each narrower and stronger,
 *  composited over one another. Cheaper than feGaussianBlur on every frame. */
const SOFT_BANDS = [
  { width: 24, opacity: 0.05 },
  { width: 15, opacity: 0.06 },
  { width: 7, opacity: 0.07 },
]

export function EnvelopeSvg({ progress = 0, part = 'front', className }: EnvelopeSvgProps) {
  const p = clamp01(progress)
  const lifted = p >= 0.5 // past vertical: the flap's back is what we see
  // both parts live in one document, so their ids must not collide
  const id = (name: string): string => `${part}-${name}`

  const flap = (
    <g transform={`translate(0 ${(2 * HINGE * p).toFixed(2)}) scale(1 ${(1 - 2 * p).toFixed(3)})`}>
      <path d={FLAP} fill={`url(#${id('shadow')})`} opacity={lifted ? 1 : 0} />
      {!lifted ? <path d={FLAP} fill={`url(#${id('flapShut')})`} /> : null}
      {!lifted ? <path d={FLAP_EDGE} fill="none" stroke="#d3c6ae" strokeWidth="1" /> : null}
      {/* the glued margin travels with the flap, so it unfolds instead of appearing */}
      {lifted ? <path d={STRIP_LOCAL} fill="none" stroke="#f2e9d8" strokeWidth="18" /> : null}
    </g>
  )

  return (
    <svg
      viewBox="26 256 588 363"
      className={className}
      role="presentation"
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={id('shadow')} x1="0" y1="33" x2="0" y2="485" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5f5647" />
          <stop offset="0.42" stopColor="#6f6553" />
          <stop offset="1" stopColor="#8b7d65" />
        </linearGradient>
        <linearGradient id={id('face')} x1="0" y1="256" x2="0" y2="619" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fdf8ee" />
          <stop offset="1" stopColor="#e6dac2" />
        </linearGradient>
        <linearGradient id={id('flapShut')} x1="0" y1="256" x2="0" y2="479" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fdf8ee" />
          <stop offset="1" stopColor="#f2e9d7" />
        </linearGradient>
        <linearGradient id={id('pocket')} x1="0" y1="443" x2="0" y2="619" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fdf8ee" />
          <stop offset="1" stopColor="#dccfb4" />
        </linearGradient>
        <linearGradient id={id('side')} x1="0" y1="256" x2="0" y2="619" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f1e8d7" />
          <stop offset="1" stopColor="#dfd2b8" />
        </linearGradient>
        <filter id={id('drop')} x="-40%" y="-60%" width="180%" height="220%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="#000000" floodOpacity="0.55" />
        </filter>
        <clipPath id={id('bodyClip')}>
          <path d={CLIP} />
        </clipPath>
      </defs>

      {part === 'back' ? (
        /* only the standing flap belongs behind the letter */
        lifted ? flap : null
      ) : (
        <>
          {/* The drop shadow sits on a static silhouette, not on the animated content:
              Safari re-rasterises an SVG filter on every frame in which anything inside
              it moves. This element never changes, so its filter is computed once; the
              opaque body covers the black shape. */}
          <g filter={`url(#${id('drop')})`}>
            <path d={CLIP} fill="#14110e" />
          </g>

          <g clipPath={`url(#${id('bodyClip')})`}>
            {/* paper behind everything, so no gap can show the page */}
            <rect x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} fill={`url(#${id('face')})`} />

            {/* the inside — always there, revealed as the flap lifts off it */}
            <path d={INTERIOR} fill={`url(#${id('shadow')})`} />

            {/* the side flaps' edges casting onto the inside */}
            {SOFT_BANDS.map((band) => (
              <g
                key={band.width}
                fill="none"
                stroke="#2b2417"
                strokeWidth={band.width}
                opacity={band.opacity}
              >
                <path d={SIDE_EDGE_LEFT} />
                <path d={SIDE_EDGE_RIGHT} />
              </g>
            ))}

            {/* the bottom flap */}
            <path d={POCKET} fill={`url(#${id('pocket')})`} />
            <path d={POCKET} fill="none" stroke="#c9ba9f" strokeWidth="1.1" opacity="0.6" />

            {/* seams from the bottom corners to the side flaps */}
            <path d="M26 619 L290 453" fill="none" stroke="#b9a98d" opacity="0.45" />
            <path d="M614 619 L350 453" fill="none" stroke="#b9a98d" opacity="0.45" />
          </g>

          {/* the shadow the flap throws while it still lies on the paper. It has to go
              at once: the flap is off the paper after the first pixels of scroll. */}
          {p < 0.12 ? (
            <g fill="none" stroke="#5a4d3a" opacity={(1 - p / 0.12).toFixed(3)}>
              <path d={FLAP_SHADOW} strokeWidth="11" opacity="0.05" />
              <path d={FLAP_SHADOW} strokeWidth="5" opacity="0.06" />
            </g>
          ) : null}

          <g clipPath={`url(#${id('bodyClip')})`}>
            {/* the side flaps folded in */}
            <path d={SIDE_LEFT} fill={`url(#${id('side')})`} />
            <path d={SIDE_RIGHT} fill={`url(#${id('side')})`} />

            {/* the contour: left, bottom, right — the top edge stays open */}
            <path d={OUTLINE} fill="none" stroke="#c9bba3" />
          </g>

          {/* while sealed the flap lies on the body, so it is painted here, on top */}
          {lifted ? null : flap}
        </>
      )}
    </svg>
  )
}
