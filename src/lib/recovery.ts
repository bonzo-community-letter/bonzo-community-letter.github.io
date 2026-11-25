/**
 * How a recovery rate is shown, in numbers rather than in a component.
 *
 * The scale runs red → amber → green: nothing back, half back, all back. It is
 * interpolated in HSL because that is what makes the middle read as yellow rather than
 * as a muddy brown — a straight RGB blend from red to green passes through grey.
 *
 * A missing rate is not a zero and must not look like one: it gets its own colour
 * (brown, the palette's own quiet tone) and a dash instead of a number.
 */

/** The colour for "no rate given" — brown, not red: silence is not failure. */
export const NO_RATE_COLOUR = 'hsl(26 26% 40%)'

/** The same brown, light enough to read as text on the page's dark ground. */
export const NO_RATE_INK = 'hsl(26 30% 64%)'

/** Red, amber, green — the three points the scale passes through. */
const RED = { at: 0, hue: 5, saturation: 58, lightness: 50 } as const
const AMBER = { at: 50, hue: 42, saturation: 68, lightness: 55 } as const
const GREEN = { at: 100, hue: 134, saturation: 38, lightness: 47 } as const

/** Clamped to 0–100; anything else in the payload is treated as the nearest end. */
export function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return 0
  return Math.min(100, Math.max(0, rate))
}

/**
 * The colour for a rate, as an `hsl()` string.
 *
 * `null` — the signer did not say — is brown, and never a red that would read as
 * "recovered nothing".
 */
export function recoveryColour(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return NO_RATE_COLOUR

  const value = clampRate(rate)
  // two straight segments: red → amber, then amber → green
  const from = value <= AMBER.at ? RED : AMBER
  const to = value <= AMBER.at ? AMBER : GREEN
  const t = (value - from.at) / (to.at - from.at)

  const hue = from.hue + (to.hue - from.hue) * t
  const saturation = from.saturation + (to.saturation - from.saturation) * t
  const lightness = from.lightness + (to.lightness - from.lightness) * t

  return `hsl(${hue.toFixed(1)} ${saturation.toFixed(1)}% ${lightness.toFixed(1)}%)`
}

/**
 * The number inside the ring: the ring's own colour, lifted until it reads as text.
 *
 * At 38 px the digits sit on a dark ground behind a tinted disc; the arc's colour is
 * chosen to be seen as a shape, which is not the same as being legible as a number.
 */
export function recoveryInkColour(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return NO_RATE_INK
  const value = clampRate(rate)
  const from = value <= AMBER.at ? RED : AMBER
  const to = value <= AMBER.at ? AMBER : GREEN
  const t = (value - from.at) / (to.at - from.at)
  const hue = from.hue + (to.hue - from.hue) * t
  return `hsl(${hue.toFixed(1)} 58% 76%)`
}

/**
 * What the circle says: the rate rounded to a whole percent, or a dash.
 *
 * Whole numbers because a ring that is 8.8 % full is 9 % full to anyone looking at it,
 * and "8.8" does not fit in the middle of a 40 px circle.
 */
export function recoveryLabel(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return '–'
  return String(Math.round(clampRate(rate)))
}

/**
 * What a signer's rate says about what is still missing.
 *
 * The ring shows what came back; this line shows what did not, because the addressees
 * are being asked about the loss, not about the recovery. The two are complements of
 * the same number, so they cannot drift apart — and silence is named as silence rather
 * than rendered as a 100 % loss the signer never claimed.
 */
export function lossLine(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return 'Losses not stated'
  return `${Math.round(100 - clampRate(rate))}% of net supply lost`
}

/** How much of the circle's circumference the arc covers, 0–1. */
export function recoveryFraction(rate: number | null): number {
  if (rate === null || !Number.isFinite(rate)) return 0
  return clampRate(rate) / 100
}
