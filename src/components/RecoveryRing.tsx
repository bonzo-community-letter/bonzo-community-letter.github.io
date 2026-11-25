import {
  NO_RATE_COLOUR,
  recoveryColour,
  recoveryFraction,
  recoveryInkColour,
  recoveryLabel,
} from '../lib/recovery'

/**
 * The share of a signer's loss that has been recovered, as a ring.
 *
 * A filled disc with the percentage in it, and an outline whose arc is that same
 * percentage — so the number and the shape cannot disagree, and a reader who does not
 * read the number still sees the size. The colour runs red → amber → green with the
 * rate. Without a rate the ring is brown and says `–`: silence is not "nothing
 * recovered", and the two must not look alike.
 */
export function RecoveryRing({
  rate,
  size = 44,
}: {
  rate: number | null
  /** Outer size in px; the stroke scales with it. */
  size?: number
}) {
  const stroke = Math.max(3, Math.round(size * 0.105))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const fraction = recoveryFraction(rate)
  const colour = recoveryColour(rate)
  const label = recoveryLabel(rate)
  const ink = recoveryInkColour(rate)
  const missing = rate === null

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      title={
        missing
          ? 'No recovery rate given'
          : `${label}% of the signer's loss has been recovered`
      }
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        aria-hidden="true"
        className="absolute inset-0 -rotate-90"
      >
        {/* the disc: the colour at a whisper, so the number stays readable */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius - stroke / 2 - 1}
          fill={colour}
          fillOpacity={missing ? 0.22 : 0.16}
        />
        {/* the track: what is left of the circle when the arc is short */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={missing ? NO_RATE_COLOUR : colour}
          strokeOpacity={missing ? 0.34 : 0.22}
          strokeWidth={stroke}
        />
        {!missing && fraction > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colour}
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeDasharray={`${circumference * fraction} ${circumference}`}
          />
        )}
      </svg>
      <span
        className="relative font-mono leading-none tabular-nums"
        style={{ color: ink, fontSize: Math.round(size * 0.31) }}
      >
        {label}
        {!missing && (
          <span style={{ fontSize: Math.round(size * 0.19) }} className="ml-[0.5px] align-super">
            %
          </span>
        )}
      </span>
    </span>
  )
}
