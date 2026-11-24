/**
 * The arithmetic of an endless band.
 *
 * Kept apart from the component so it can be tested without a browser: the drift, and
 * the rewind that makes the end of the strip look like its beginning.
 */

/**
 * Where the strip should be after `elapsedMs` of drifting.
 *
 * `setWidth` is the width of one copy of the comments; the strip holds at least two, so
 * subtracting it once the strip has travelled a full copy is invisible — the copy that
 * takes over is identical to the one that left. `elapsedMs` is capped by the caller so a
 * backgrounded tab does not jump when it wakes.
 */
export function nextOffset(current: number, setWidth: number, speed: number, elapsedMs: number): number {
  if (!Number.isFinite(current) || setWidth <= 0 || !Number.isFinite(elapsedMs)) return current
  const moved = current + (speed * Math.max(0, elapsedMs)) / 1000
  if (moved < setWidth) return moved
  // `%` rather than `-`: a very long pause can pass more than one copy.
  return moved % setWidth
}

/** How many copies of the comments the strip needs so it never shows its seam. */
export function copiesFor(count: number): number {
  if (count <= 0) return 1
  return count >= 4 ? 2 : Math.ceil(8 / count)
}
