import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

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
 * Two separate draws decide what you see:
 *
 *  - **Where** a mark sits, how big and how tilted, comes from a generator seeded by the
 *    accounts themselves, so the wall does not jump around while you read.
 *  - **Which** account is written there is shuffled fresh on every load, so a reload is
 *    a different slice of the signatures and every signer turns up eventually.
 *
 * Marks are laid out on a measured grid: the number of columns and the size of the hand
 * follow the window, and the jitter stays inside the cell, so two ids rarely land on top
 * of each other. A cell holds one mark; the size is derived from the cell, not the other
 * way round.
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

/** Fisher–Yates on a copy. */
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const a = out[i]
    const b = out[j]
    if (a === undefined || b === undefined) continue
    out[i] = b
    out[j] = a
  }
  return out
}

interface Slot {
  left: number
  top: number
  size: number
  rotate: number
  opacity: number
}

const MIN_COLUMNS = 3
const MAX_COLUMNS = 9
/** Roughly the width a cell needs for a 12-character id to sit inside it. */
const COLUMN_WIDTH = 165
const ROW_HEIGHT = 86

/**
 * Where the marks go, in percentages, for a viewport of this size.
 *
 * One mark per cell, jittered by at most a fifth of a cell in each direction, with the
 * type size tied to the cell width — a wide window gets more columns and larger hands,
 * a phone gets three and small ones, and neither stacks ids on top of each other.
 */
export function layoutSlots(width: number, height: number, random: () => number): Slot[] {
  const columns = Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, Math.round(width / COLUMN_WIDTH)))
  const rows = Math.max(3, Math.round(height / ROW_HEIGHT))
  const cellWidth = width / columns
  // A twelve-character id in this hand is about five times its font size wide; keep it
  // inside 70% of the cell and nothing has to overlap to fit.
  const baseSize = Math.min(1.55, Math.max(0.6, (cellWidth * 0.14) / 16))

  const slots: Slot[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      // one in six is written larger and darker, as a hand would not keep one weight
      const loud = random() < 0.16
      const jitterX = (random() - 0.5) * 0.34
      const jitterY = (random() - 0.5) * 0.3
      slots.push({
        left: ((column + 0.5 + jitterX) / columns) * 100,
        top: ((row + 0.5 + jitterY) / rows) * 100,
        // the loud ones are bigger, but never beyond what the cell holds
        size: Math.min(1.7, baseSize * (loud ? 1.22 : 0.82 + random() * 0.18)),
        rotate: (random() - 0.5) * 9,
        opacity: loud ? 0.2 + random() * 0.05 : 0.09 + random() * 0.04,
      })
    }
  }
  return slots
}

export function Backdrop({ accounts }: { accounts: readonly string[] }) {
  const unique = useMemo(
    () => [...new Set(accounts.map((id) => id.trim()).filter(Boolean))],
    [accounts],
  )

  const [viewport, setViewport] = useState(() =>
    typeof window === 'undefined' ? { width: 1280, height: 800 } : { width: window.innerWidth, height: window.innerHeight },
  )

  useLayoutEffect(() => {
    const measure = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Positions: stable for a given set of signers and window, so nothing shifts while reading.
  const slots = useMemo(
    () => layoutSlots(viewport.width, viewport.height, seeded(hash(unique.join('|')) || 1)),
    [unique, viewport.width, viewport.height],
  )

  // Who is written where: reshuffled on every load, so a reload shows other signers.
  const [loadSeed] = useState(() => Math.floor(Math.random() * 0xffffffff))

  const marks = useMemo(() => {
    if (unique.length === 0) return []
    const order = shuffled(unique, seeded(loadSeed || 1))
    return slots.map((slot, index) => ({
      ...slot,
      accountId: order[index % order.length] ?? '',
    }))
  }, [slots, unique, loadSeed])

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
          key={`${index}-${mark.accountId}`}
          ref={(node) => {
            nodes.current[index] = node
          }}
          className="bg-id absolute whitespace-nowrap"
          style={{
            left: `${mark.left}%`,
            top: `${mark.top}%`,
            fontSize: `${mark.size.toFixed(3)}rem`,
            opacity: lifted === index ? 0.6 : mark.opacity,
            color: lifted === index ? 'var(--color-accent)' : undefined,
            transform: `translate(-50%, -50%) rotate(${mark.rotate.toFixed(2)}deg) scale(${lifted === index ? 1.9 : 1})`,
          }}
        >
          {mark.accountId}
        </span>
      ))}
    </div>
  )
}
