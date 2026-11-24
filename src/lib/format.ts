/**
 * Dates as the page says them.
 *
 * Always UTC and always with the same shape: a signature's `signedAt` is the client's
 * own claim, and printing it in the reader's timezone would make two signatures look
 * like they happened at different times depending on who is reading.
 */

/** "24 Nov 2026, 15:49 UTC" — or "24 Nov 2026" when the time is not wanted. */
export function signedWhen(iso: string, options: { time?: boolean } = {}): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const withTime = options.time ?? true
  const stamp = date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
  return withTime ? `${stamp} UTC` : stamp
}
