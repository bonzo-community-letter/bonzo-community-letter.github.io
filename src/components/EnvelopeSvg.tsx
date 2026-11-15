/**
 * An envelope drawn as SVG, in two states that share one geometry.
 *
 * Sealed (`flapOpen` 0): the outer back, the pocket folded up from the bottom,
 * and the top flap lying over it.
 *
 * Opened (`flapOpen` 1): the outer back has faded away, so the envelope is a
 * *hole* with a shadowed rim — whatever sits behind it shows through as the
 * letter inside. The flap has swung up past the top edge on its hinge and stays
 * there, visible, drawn behind the body the way a real opened flap stands.
 *
 * Geometry: 600×400, 3:2. Fold vertex at (300, 186); the flap's tip at
 * (300, 246), i.e. 60px past it, so the flap visibly overlaps the pocket. The
 * hinge is y=8, so a fully opened flap reaches y=-230 — outside the viewBox,
 * which is why the SVG must not clip (`overflow: visible`).
 */

interface EnvelopeSvgProps {
  /** 0 = sealed, 1 = flap fully open */
  flapOpen?: number
  className?: string
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const BODY = { x: 6, y: 6, w: 588, h: 388, r: 7 }
const FLAP = 'M8 8 L592 8 L300 246 Z'
const POCKET = 'M6 394 L300 186 L594 394 Z'
/** The hinge sits at y=8; mirroring about it means translating by twice that. */
const HINGE = 8

export function EnvelopeSvg({ flapOpen = 0, className }: EnvelopeSvgProps) {
  const open = clamp01(flapOpen)
  const flip = 1 - 2 * open

  // the outer back fades once the flap is clearly up, so the letter behind
  // shows through as the envelope's interior
  const backOpacity = clamp01(1 - (open - 0.35) / 0.4)
  const interiorOpacity = clamp01((open - 0.3) / 0.4)

  const flap = (
    <g transform={`translate(0 ${(2 * HINGE * open).toFixed(2)}) scale(1 ${flip.toFixed(3)})`}>
      <path d={FLAP} fill="url(#env-flap)" />
      {/* seen from behind, the flap's inner face is the darker side */}
      <path d={FLAP} fill="#8a7654" opacity={(0.22 * open).toFixed(3)} />
      <path d={FLAP} fill="none" stroke="#cdbfa7" strokeWidth="1.1" />
      <path d="M10 13 L300 244 L590 13" fill="none" stroke="#a9967a" strokeWidth="2.2" opacity="0.4" />
      <path d="M8 8 L592 8" stroke="#c7b9a1" strokeWidth="1.4" opacity="0.9" />
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
      style={{ overflow: 'visible' }}
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

        {/* the rim of the opening: dark at the lip, clear towards the middle */}
        <linearGradient id="env-interior" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2216" stopOpacity="0.55" />
          <stop offset="0.16" stopColor="#2b2216" stopOpacity="0.22" />
          <stop offset="0.42" stopColor="#2b2216" stopOpacity="0.05" />
          <stop offset="1" stopColor="#2b2216" stopOpacity="0" />
        </linearGradient>

        <filter id="env-blur" x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur stdDeviation="7" />
        </filter>

        <filter id="env-drop" x="-40%" y="-70%" width="180%" height="240%">
          <feDropShadow dx="0" dy="16" stdDeviation="18" floodColor="#000000" floodOpacity="0.5" />
        </filter>

        <filter id="env-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>

        <clipPath id="env-clip">
          <rect x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} rx={BODY.r} />
        </clipPath>
      </defs>

      <g filter="url(#env-drop)">
        {/* the opened flap stands behind the envelope, clear of the body */}
        {open > 0.5 ? flap : null}

        <g clipPath="url(#env-clip)">
          {/* the outer back, present only while the envelope is still sealed */}
          {backOpacity > 0.01 ? (
            <rect
              x={BODY.x}
              y={BODY.y}
              width={BODY.w}
              height={BODY.h}
              fill="url(#env-body)"
              opacity={backOpacity.toFixed(3)}
            />
          ) : null}

          {/* the interior: a shadowed rim around a hole the letter shows through */}
          {interiorOpacity > 0.01 ? (
            <rect
              x={BODY.x}
              y={BODY.y}
              width={BODY.w}
              height={BODY.h}
              fill="url(#env-interior)"
              opacity={interiorOpacity.toFixed(3)}
            />
          ) : null}

          {/* pocket: the bottom flap folded up, its top edge a V — the vertex sits
              above the top flap's tip, so the flap overlaps it */}
          <path d={POCKET} fill="url(#env-pocket)" />
          <path d={POCKET} fill="none" stroke="#c8b9a0" strokeWidth="1.2" />
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
          <rect
            x={BODY.x}
            y={BODY.y}
            width={BODY.w}
            height={BODY.h}
            filter="url(#env-grain)"
            opacity="0.05"
          />

          {/* outline, and the lip of the opening once it is open */}
          <rect
            x={BODY.x + 0.5}
            y={BODY.y + 0.5}
            width={BODY.w - 1}
            height={BODY.h - 1}
            rx={BODY.r}
            fill="none"
            stroke="#c9bba3"
            strokeWidth="1"
          />
          <path
            d={`M${BODY.x} ${HINGE} L${BODY.x + BODY.w} ${HINGE}`}
            stroke="#3a2f21"
            strokeWidth="2.5"
            opacity={(0.5 * interiorOpacity).toFixed(3)}
          />
        </g>
      </g>
    </svg>
  )
}
