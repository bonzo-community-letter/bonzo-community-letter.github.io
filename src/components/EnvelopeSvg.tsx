/**
 * The envelope, drawn once and animated by a single parameter.
 *
 * progress 0 — sealed: a paper flap lying over the outside surface.
 * progress 1 — open:   the same flap standing behind the body, the inside dark,
 *                      the glued margin showing along its edges.
 *
 * Both states are one geometry. The flap is a triangle whose tip sits 223 units
 * below the hinge when closed (y = 479) and 223 above it when open (y = 33), so
 * mirroring about y = 256 is exactly the difference between them — no second
 * shape, no cross-fade of two drawings. What does cross-fade is only what the
 * flap hides: the outside surface gives way to the dark inside, and the paper
 * face of the flap gives way to its shadowed back.
 */

interface EnvelopeSvgProps {
  /** 0 = sealed, 1 = open */
  progress?: number
  className?: string
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/* ── geometry, measured off the approved drawings ─────────────────────────── */
const BODY = { x: 26, y: 256, w: 588, h: 363, r: 7 }
const HINGE = 256
const FLAP_TIP = 479 // closed; 223 below the hinge
const FLAP = `M33 ${HINGE} L607 ${HINGE} L320 ${FLAP_TIP} Z`
const FLAP_EDGE = `M33 ${HINGE} L320 ${FLAP_TIP} L607 ${HINGE}`
const FLAP_SHADOW = `M33 ${HINGE + 3} L320 ${FLAP_TIP + 3} L607 ${HINGE + 3}`
const INTERIOR = 'M26 256 L614 256 L320 485 Z'
const POCKET =
  'M26 619 L290.2 452.75 C290.2 452.75 308.26 443 320 443 C331.78 443 349.91 452.82 349.91 452.82 L614 619 Z'
const SIDE_LEFT = 'M26 619 L290 453 C290 453 138 321 57 261 C50 256 26 256 26 256 Z'
const SIDE_RIGHT = 'M614 619 L350 453 C350 453 502 321 583 261 C590 256 614 256 614 256 Z'
const SIDE_EDGE_LEFT = 'M26 256 C26 256 50 256 57 261 C138 321 290 453 290 453'
const SIDE_EDGE_RIGHT = 'M614 256 C614 256 590 256 583 261 C502 321 350 453 350 453'
const STRIP = 'M31.81 263.49 L320.5 33 L608 263'
const OUTLINE =
  'M26 257 L26 612 C26 615.87 29.13 619 33 619 L607 619 C610.13 619 614 615.87 614 612 L614 257'
/** The body's silhouette: square at the fold, rounded at the bottom. */
const CLIP = 'M26 256 L614 256 L614 612 C614 615.87 610.87 619 607 619 L33 619 C29.13 619 26 615.87 26 612 Z'

export function EnvelopeSvg({ progress = 0, className }: EnvelopeSvgProps) {
  const p = clamp01(progress)

  return (
    <svg
      viewBox="0 0 640 640"
      className={className}
      role="presentation"
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* the shadowed side: the flap's back and the inside, one plane */}
        <linearGradient id="env-shadow" x1="0" y1="33" x2="0" y2="485" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5f5647" />
          <stop offset="0.42" stopColor="#6f6553" />
          <stop offset="1" stopColor="#8b7d65" />
        </linearGradient>
        {/* the outside surface, seen while the envelope is still sealed */}
        <linearGradient id="env-face" x1="0" y1="256" x2="0" y2="619" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fdf8ee" />
          <stop offset="1" stopColor="#e6dac2" />
        </linearGradient>
        <linearGradient id="env-flapShut" x1="0" y1="256" x2="0" y2="479" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fdf8ee" />
          <stop offset="1" stopColor="#f2e9d7" />
        </linearGradient>
        <linearGradient id="env-pocket" x1="0" y1="443" x2="0" y2="619" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fdf8ee" />
          <stop offset="1" stopColor="#dccfb4" />
        </linearGradient>
        <linearGradient id="env-side" x1="0" y1="256" x2="0" y2="619" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f1e8d7" />
          <stop offset="1" stopColor="#dfd2b8" />
        </linearGradient>
        <filter id="env-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
        <filter id="env-drop" x="-40%" y="-60%" width="180%" height="220%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="#000000" floodOpacity="0.55" />
        </filter>
        <clipPath id="env-bodyClip">
          <path d={CLIP} />
        </clipPath>
      </defs>

      <g filter="url(#env-drop)">
        <g clipPath="url(#env-bodyClip)">
          {/* 1 · the outside surface — what a sealed envelope shows */}
          <rect x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} fill="url(#env-face)" />

          {/* 2 · the inside, coming up as the flap lifts */}
          {p > 0.001 ? <path d={INTERIOR} fill="url(#env-shadow)" opacity={p.toFixed(3)} /> : null}

          {/* 3 · the side flaps' edges casting onto the inside */}
          {p > 0.001 ? (
            <g opacity={p.toFixed(3)}>
              <path d={SIDE_EDGE_LEFT} fill="none" stroke="#2b2417" strokeWidth="12" opacity="0.22" filter="url(#env-soft)" />
              <path d={SIDE_EDGE_RIGHT} fill="none" stroke="#2b2417" strokeWidth="12" opacity="0.22" filter="url(#env-soft)" />
            </g>
          ) : null}

          {/* 4 · the bottom flap */}
          <path d={POCKET} fill="url(#env-pocket)" />
          <path d={POCKET} fill="none" stroke="#c9ba9f" strokeWidth="1.1" opacity="0.6" />

          {/* 5 · seams from the bottom corners to the side flaps */}
          <path d="M26 619 L290 453" fill="none" stroke="#b9a98d" opacity="0.45" />
          <path d="M614 619 L350 453" fill="none" stroke="#b9a98d" opacity="0.45" />
        </g>

        {/* 6 · the shadow the flap casts while it still lies on the paper */}
        {p < 0.999 ? (
          <path
            d={FLAP_SHADOW}
            fill="none"
            stroke="#5a4d3a"
            strokeWidth="7"
            opacity={(0.1 * (1 - p)).toFixed(3)}
            filter="url(#env-soft)"
          />
        ) : null}

        {/* 7 · the flap itself, hinged on the fold: mirroring it about y = 256 turns
             the sealed triangle into the standing one */}
        <g transform={`translate(0 ${(2 * HINGE * p).toFixed(2)}) scale(1 ${(1 - 2 * p).toFixed(3)})`}>
          {p < 0.999 ? <path d={FLAP} fill="url(#env-flapShut)" opacity={(1 - p).toFixed(3)} /> : null}
          {p > 0.001 ? <path d={FLAP} fill="url(#env-shadow)" opacity={p.toFixed(3)} /> : null}
          {p < 0.999 ? (
            <path d={FLAP_EDGE} fill="none" stroke="#d3c6ae" strokeWidth="1" opacity={(1 - p).toFixed(3)} />
          ) : null}
        </g>

        {/* 8 · the glued margin, which only exists on the flap's inner side */}
        {p > 0.001 ? (
          <path d={STRIP} fill="none" stroke="#f2e9d8" strokeWidth="18" opacity={p.toFixed(3)} />
        ) : null}

        <g clipPath="url(#env-bodyClip)">
          {/* 9 · the side flaps folded in, over the strip's ends */}
          <path d={SIDE_LEFT} fill="url(#env-side)" />
          <path d={SIDE_RIGHT} fill="url(#env-side)" />

          {/* 10 · the contour: left, bottom, right — the top edge stays open */}
          <path d={OUTLINE} fill="none" stroke="#c9bba3" />
        </g>
      </g>
    </svg>
  )
}
