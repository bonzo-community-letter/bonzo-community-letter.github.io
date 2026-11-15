/**
 * An envelope drawn as SVG.
 *
 * Anatomy, in paint order: body → pocket (the bottom flap, folded up) → the two
 * fold seams → the top flap, hinged on the top edge. `flapOpen` runs 0 (sealed)
 * to 1 (fully open); the flap is mirrored about its hinge, so at 0.5 it is
 * edge-on, and past 0.5 it is painted *before* the pocket so it reads as lying
 * behind it.
 *
 * The geometry is one rectangle (600×400, 3:2) with the fold vertex at
 * (300, 208) — slightly below centre, the way a real envelope's flaps meet.
 */

interface EnvelopeSvgProps {
  /** 0 = sealed, 1 = flap fully open */
  flapOpen?: number
  className?: string
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

export function EnvelopeSvg({ flapOpen = 0, className }: EnvelopeSvgProps) {
  const open = clamp01(flapOpen)
  const flip = 1 - 2 * open

  const flap = (
    <g transform={`translate(0 ${(16 * open).toFixed(2)}) scale(1 ${flip.toFixed(3)})`}>
      <path d="M8 8 L592 8 L300 246 Z" fill="url(#env-flap)" />
      <path d="M8 8 L592 8 L300 246 Z" fill="none" stroke="#cdbfa7" strokeWidth="1.1" />
      {/* the flap's lower edges in shadow, where it lies over the pocket */}
      <path d="M10 13 L300 244 L590 13" fill="none" stroke="#a9967a" strokeWidth="2.2" opacity="0.4" />
      {/* the fold the flap creases along */}
      <path d="M8 8 L592 8" stroke="#c7b9a1" strokeWidth="1.4" opacity="0.9" />
      {/* light catching the flap's upper surface */}
      <path d="M30 20 L570 20" stroke="#fffdf7" strokeWidth="6" opacity="0.55" />
    </g>
  )

  return (
    <svg
      viewBox="0 0 600 400"
      preserveAspectRatio="none"
      className={className}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="env-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4ecdd" />
          <stop offset="0.55" stopColor="#eee4d2" />
          <stop offset="1" stopColor="#e6dbc6" />
        </linearGradient>

        <linearGradient id="env-flap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdf8ee" />
          <stop offset="1" stopColor="#f2e9d7" />
        </linearGradient>

        <linearGradient id="env-pocket" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9dfcc" />
          <stop offset="1" stopColor="#e0d5bf" />
        </linearGradient>

        {/* the shading that falls from the flap onto the pocket */}
        <linearGradient id="env-shadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6b5b42" stopOpacity="0.22" />
          <stop offset="1" stopColor="#6b5b42" stopOpacity="0" />
        </linearGradient>

        <filter id="env-blur" x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur stdDeviation="7" />
        </filter>

        <filter id="env-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>

        <clipPath id="env-clip">
          <rect x="6" y="6" width="588" height="388" rx="7" />
        </clipPath>
      </defs>

      <g clipPath="url(#env-clip)">
        {/* body */}
        <rect x="6" y="6" width="588" height="388" fill="url(#env-body)" />

        {/* past halfway the flap has swung behind the pocket */}
        {open > 0.5 ? flap : null}

        {/* pocket: the bottom flap folded up, its top edge a V — the vertex sits
            above the top flap's tip, so the flap overlaps it */}
        <path d="M6 394 L300 186 L594 394 Z" fill="url(#env-pocket)" />
        <path d="M6 394 L300 186 L594 394" fill="none" stroke="#c8b9a0" strokeWidth="1.2" />

        {/* the two side folds of the pocket, catching a little light */}
        <path d="M6 394 L300 186" stroke="#fbf6ea" strokeWidth="1" opacity="0.7" />
        <path d="M594 394 L300 186" stroke="#fbf6ea" strokeWidth="1" opacity="0.7" />

        {/* shade under the flap, cast onto the pocket */}
        {open <= 0.5 ? (
          <path
            d="M8 26 L300 264 L592 26"
            fill="none"
            stroke="url(#env-shadow)"
            strokeWidth="16"
            opacity="0.85"
            filter="url(#env-blur)"
          />
        ) : null}

        {open <= 0.5 ? flap : null}

        {/* paper grain over everything, very faint */}
        <rect x="6" y="6" width="588" height="388" filter="url(#env-grain)" opacity="0.05" />

        {/* outline */}
        <rect
          x="6.5"
          y="6.5"
          width="587"
          height="387"
          rx="7"
          fill="none"
          stroke="#c9bba3"
          strokeWidth="1"
        />
      </g>
    </svg>
  )
}
