/**
 * The wax seal on the letter.
 *
 * A seal authenticates, so it carries a mark this campaign actually owns — the
 * letter's own monogram — not a third party's logo. Sealing an open letter *to*
 * Hedera with Hedera's mark would read as their endorsement of it, which is the
 * one impression the letter cannot afford (see README, "Logos and trademarks").
 *
 * The wax is drawn, not filtered: one irregular body, a lit lip, a pressed ring,
 * and the monogram engraved three times — shadow above, catch-light below, wax
 * colour between — which is what makes it look pressed in rather than printed on.
 * The only filter is a CSS drop-shadow on the wrapper: it grounds the seal on the
 * paper without an SVG filter pass.
 */

/** A hand-pressed edge: a circle with a fixed wobble and four slight lobes. */
const BLOB =
  'M50.00,4.37C55.51,4.13 61.63,2.42 66.79,3.87C71.95,5.33 77.19,9.22 80.94,13.13C84.69,17.03 86.88,22.51 89.28,27.32C91.68,32.14 93.94,36.82 95.35,42.00C96.75,47.19 98.87,53.38 97.72,58.42C96.58,63.45 91.54,67.79 88.46,72.21C85.39,76.62 83.07,81.38 79.28,84.90C75.50,88.41 70.64,91.21 65.76,93.30C60.88,95.38 55.30,97.26 50.00,97.39C44.70,97.52 38.78,96.22 33.96,94.07C29.14,91.92 24.69,88.20 21.06,84.49C17.42,80.79 15.02,76.24 12.15,71.85C9.29,67.46 5.25,63.14 3.85,58.14C2.44,53.14 2.61,46.99 3.73,41.84C4.85,36.69 7.96,31.97 10.56,27.23C13.15,22.49 15.43,17.05 19.29,13.40C23.15,9.75 28.62,6.83 33.74,5.32C38.86,3.82 44.49,4.62 50.00,4.37Z'

const SERIF = "ui-serif, Georgia, 'Iowan Old Style', 'Times New Roman', serif"

export function WaxSeal({
  monogram,
  size = 132,
  className = '',
}: {
  monogram: string
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={`overflow-visible ${className}`}
      style={{ filter: 'drop-shadow(0 4px 7px rgba(30,12,4,0.45))' }}
    >
      <defs>
        {/* the wax: lit from the upper left, dark where it meets the paper */}
        <radialGradient id="wax-face" cx="34%" cy="26%" r="86%">
          <stop offset="0%" stopColor="#dd9070" />
          <stop offset="40%" stopColor="#c96f48" />
          <stop offset="76%" stopColor="#a04a2c" />
          <stop offset="100%" stopColor="#6f2c19" />
        </radialGradient>
        {/* the lip: a raised edge catching the light on one side only */}
        <linearGradient id="wax-lip" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="rgba(255,220,193,0.62)" />
          <stop offset="42%" stopColor="rgba(255,220,193,0.06)" />
          <stop offset="100%" stopColor="rgba(56,16,4,0.5)" />
        </linearGradient>
      </defs>

      {/* the flange: wax squeezed out past the die, a hair wider and darker */}
      <path d={BLOB} fill="#8d3d24" transform="translate(50 50) scale(1.035) translate(-50 -50)" />

      <path d={BLOB} fill="url(#wax-face)" />

      {/* the rim the die left behind */}
      <path d={BLOB} fill="none" stroke="url(#wax-lip)" strokeWidth="2.4" />

      {/* the pressed ring around the monogram */}
      <circle cx="50" cy="50" r="31" fill="none" stroke="rgba(74,24,8,0.5)" strokeWidth="1.7" />
      <circle
        cx="50"
        cy="50"
        r="31"
        fill="none"
        stroke="rgba(255,224,200,0.34)"
        strokeWidth="1.1"
        transform="translate(0 -1.1)"
      />

      {/* engraved monogram: shadow above, catch-light below, wax colour between */}
      <text
        x="50"
        y="60.2"
        textAnchor="middle"
        fontFamily={SERIF}
        fontSize="36"
        fontWeight="700"
        letterSpacing="1.8"
        fill="rgba(56,16,4,0.62)"
      >
        {monogram}
      </text>
      <text
        x="50"
        y="62.6"
        textAnchor="middle"
        fontFamily={SERIF}
        fontSize="36"
        fontWeight="700"
        letterSpacing="1.8"
        fill="rgba(255,226,203,0.34)"
      >
        {monogram}
      </text>
      <text
        x="50"
        y="61.4"
        textAnchor="middle"
        fontFamily={SERIF}
        fontSize="36"
        fontWeight="700"
        letterSpacing="1.8"
        fill="#a8532f"
      >
        {monogram}
      </text>
    </svg>
  )
}
