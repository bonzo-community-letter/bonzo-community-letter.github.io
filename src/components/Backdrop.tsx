import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * The signers' account ids, written across the background like a signature wall.
 *
 * Behind everything (the page paints over it where it has its own surface — the letter
 * stays a sheet of paper), in a hand, at a contrast low enough to read as texture.
 *
 * The hover is driven from a pointer listener rather than `:hover`: the ids sit behind
 * the page, so every section would swallow the pointer before it reached them. Instead
 * the wall hit-tests itself against the pointer and lifts the id under it — bigger,
 * darker, in the accent — while still painting behind the text.
 *
 * Positions come from a small seeded generator keyed by the accounts themselves, so the
 * wall is the same on every render and changes only when the signatures do.
 */

/** mulberry32 — small, fast, and stable enough to lay out a wall. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

interface Mark {
  accountId: string
  left: number
  top: number
  size: number
  rotate: number
  opacity: number
}

export function Backdrop({ accounts }: { accounts: readonly string[] }) {
  const marks = useMemo<Mark[]>(() => {
    const unique = [...new Set(accounts.map((id) => id.trim()).filter(Boolean))]
    if (unique.length === 0) return []

    const random = seeded(hash(unique.join('|')))

    // A jittered grid, not free scatter: scatter clumps and leaves holes, and a wall is
    // coverage. Seven columns by ten rows fills a viewport at any size, twice over.
    const columns = 7
    const rows = 10
    const cells = columns * rows
    const count = Math.min(cells * 2, Math.max(48, unique.length * 12))
    const out: Mark[] = []
    for (let i = 0; i < count; i += 1) {
      const accountId = unique[i % unique.length]
      if (accountId === undefined) continue
      const column = i % columns
      const row = Math.floor(i / columns) % rows
      // one in six is written larger and darker, as a hand would not keep one weight
      const loud = random() < 0.18
      out.push({
        accountId,
        left: ((column + 0.5 + (random() - 0.5) * 0.95) / columns) * 100,
        top: ((row + 0.5 + (random() - 0.5) * 0.9) / rows) * 100,
        size: loud ? 1.4 + random() * 0.7 : 0.72 + random() * 0.42,
        rotate: (random() - 0.5) * 16,
        opacity: loud ? 0.22 + random() * 0.07 : 0.1 + random() * 0.055,
      })
    }
    return out
  }, [accounts])

  const nodes = useRef<(HTMLSpanElement | null)[]>([])
  const boxes = useRef<{ left: number; top: number; right: number; bottom: number }[]>([])
  const [lifted, setLifted] = useState<number | null>(null)

  // The layer is fixed, so its boxes only move when the window does.
  useEffect(() => {
    if (marks.length === 0) return
    const measure = () => {
      boxes.current = nodes.current.map((node) => {
        if (!node) return { left: 0, top: 0, right: 0, bottom: 0 }
        const rect = node.getBoundingClientRect()
        const pad = 6
        return {
          left: rect.left - pad,
          top: rect.top - pad,
          right: rect.right + pad,
          bottom: rect.bottom + pad,
        }
      })
    }
    measure()
    // the hand arrives after first paint; the boxes move when it does
    void document.fonts?.ready.then(measure)
    const again = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(again)
      window.removeEventListener('resize', measure)
    }
  }, [marks])

  useEffect(() => {
    if (marks.length === 0) return
    let frame = 0
    let lastX = 0
    let lastY = 0

    const pick = () => {
      frame = 0
      let found: number | null = null
      const all = boxes.current
      for (let i = all.length - 1; i >= 0; i -= 1) {
        const box = all[i]
        if (!box) continue
        if (lastX >= box.left && lastX <= box.right && lastY >= box.top && lastY <= box.bottom) {
          found = i
          break
        }
      }
      setLifted((current) => (current === found ? current : found))
    }

    const onMove = (event: PointerEvent) => {
      lastX = event.clientX
      lastY = event.clientY
      if (frame === 0) frame = requestAnimationFrame(pick)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [marks])

  if (marks.length === 0) return null

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
      {marks.map((mark, index) => (
        <span
          key={`${mark.accountId}-${index}`}
          ref={(node) => {
            nodes.current[index] = node
          }}
          className="bg-id absolute whitespace-nowrap"
          style={{
            left: `${mark.left}%`,
            top: `${mark.top}%`,
            fontSize: `${mark.size}rem`,
            opacity: lifted === index ? 0.6 : mark.opacity,
            color: lifted === index ? 'var(--color-accent)' : undefined,
            transform: `rotate(${mark.rotate.toFixed(2)}deg) scale(${lifted === index ? 1.9 : 1})`,
          }}
        >
          {mark.accountId}
        </span>
      ))}
    </div>
  )
}
