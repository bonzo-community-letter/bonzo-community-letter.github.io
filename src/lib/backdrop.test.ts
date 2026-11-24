import { describe, expect, it } from 'vitest'
import { layoutSlots } from '../components/Backdrop'

function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('layoutSlots', () => {
  it('fills most cells and leaves some empty, so it does not read as a table', () => {
    const slots = layoutSlots(1280, 900, seeded(1))
    expect(slots.length).toBeGreaterThan(30)
    expect(slots.length).toBeLessThan(6 * 9)
  })

  it('keeps every mark inside the viewport', () => {
    for (const slot of layoutSlots(1280, 900, seeded(7))) {
      expect(slot.left).toBeGreaterThan(0)
      expect(slot.left).toBeLessThan(100)
      expect(slot.top).toBeGreaterThan(0)
      expect(slot.top).toBeLessThan(100)
    }
  })

  it('uses more columns on a wider window', () => {
    const narrow = layoutSlots(390, 844, seeded(3)).length
    const wide = layoutSlots(1600, 844, seeded(3)).length
    expect(wide).toBeGreaterThan(narrow)
  })

  it('sizes the hand to the cell, not to the window', () => {
    const phone = Math.max(...layoutSlots(390, 844, seeded(5)).map((s) => s.size))
    const desktop = Math.max(...layoutSlots(1600, 900, seeded(5)).map((s) => s.size))
    expect(desktop).toBeGreaterThan(phone)
    // and never so large that a twelve-character id would not fit its cell
    for (const slot of layoutSlots(1600, 900, seeded(5))) expect(slot.size).toBeLessThanOrEqual(1.7)
  })

  it('is the same for the same seed, so the wall does not jump while reading', () => {
    expect(layoutSlots(1280, 900, seeded(11))).toEqual(layoutSlots(1280, 900, seeded(11)))
  })

  it('moves when the seed does', () => {
    expect(layoutSlots(1280, 900, seeded(11))).not.toEqual(layoutSlots(1280, 900, seeded(12)))
  })

  it('tilts, but never so far that an id lies on its side', () => {
    for (const slot of layoutSlots(1280, 900, seeded(13))) expect(Math.abs(slot.rotate)).toBeLessThan(16)
  })
})
