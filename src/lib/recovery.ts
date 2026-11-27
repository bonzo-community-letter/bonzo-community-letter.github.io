/**
 * How a recovery rate is shown, in numbers rather than in a component.
 *
 * The scale runs from the published floor to whole: 50 % is red, 100 % is green, and the
 * range in between is spread across those fifty points. Below 50 the colour does not get
 * redder — the published range starts at 56.1 %, so a deeper red would invent a worse
 * outcome than the portal ever pays out.
 *
 * It is interpolated in HSL because that is what makes the middle read as yellow rather
 * than as a muddy brown — a straight RGB blend from red to green passes through grey.
 *
 * A missing rate is not a zero and must not look like one: it gets its own colour
 * (brown, the palette's own quiet tone) and a dash instead of a number.
 */

/** The colour for "no rate given" — brown, not red: silence is not failure. */
export const NO_RATE_COLOUR = 'hsl(26 26% 40%)'

/** The same brown, light enough to read as text on the page's dark ground. */
export const NO_RATE_INK = 'hsl(26 30% 64%)'

/** The two ends of the scale: red at the floor, green at whole. */
const FLOOR = 50
const RED = { at: FLOOR, hue: 12, saturation: 62, lightness: 52 } as const
const GREEN = { at: 100, hue: 134, saturation: 38, lightness: 47 } as const

/** How far along the scale a rate sits, 0 at the floor and 1 at whole. */
function scalePosition(rate: number): number {
  const value = Math.min(100, Math.max(FLOOR, clampRate(rate)))
  return (value - FLOOR) / (100 - FLOOR)
}

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

  // one straight run from red to green, over the fifty points that carry meaning
  const t = scalePosition(rate)
  const hue = RED.hue + (GREEN.hue - RED.hue) * t
  const saturation = RED.saturation + (GREEN.saturation - RED.saturation) * t
  const lightness = RED.lightness + (GREEN.lightness - RED.lightness) * t

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
  const t = scalePosition(rate)
  const hue = RED.hue + (GREEN.hue - RED.hue) * t
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
