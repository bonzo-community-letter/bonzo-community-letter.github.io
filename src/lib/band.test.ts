import { describe, expect, it } from 'vitest'
import { copiesFor, nextOffset } from './band'

describe('nextOffset', () => {
  it('moves at the speed it was given', () => {
    expect(nextOffset(0, 4000, 26, 1000)).toBeCloseTo(26)
    expect(nextOffset(100, 4000, 26, 500)).toBeCloseTo(113)
  })

  it('rewinds by one copy instead of running past the end', () => {
    expect(nextOffset(3990, 4000, 26, 1000)).toBeCloseTo(16)
  })

  it('rewinds correctly after a pause longer than a copy', () => {
    // 600s at 26 px/s is 15600 px: nearly four copies of a 4000 px strip
    expect(nextOffset(0, 4000, 26, 600_000)).toBeCloseTo(15600 % 4000)
  })

  it('does not move when there is nothing to move against', () => {
    expect(nextOffset(500, 0, 26, 1000)).toBe(500)
    expect(nextOffset(500, -10, 26, 1000)).toBe(500)
  })

  it('ignores a negative elapsed time', () => {
    expect(nextOffset(500, 4000, 26, -1000)).toBe(500)
  })

  it('stays put when the values are not numbers', () => {
    expect(nextOffset(Number.NaN, 4000, 26, 16)).toBeNaN()
  })
})

describe('copiesFor', () => {
  it('needs two copies once there are enough comments to fill a screen', () => {
    expect(copiesFor(4)).toBe(2)
    expect(copiesFor(40)).toBe(2)
  })

  it('repeats a short list until the strip is wide enough', () => {
    expect(copiesFor(1)).toBe(8)
    expect(copiesFor(3)).toBe(3)
  })

  it('asks for one copy when there is nothing to show', () => {
    expect(copiesFor(0)).toBe(1)
  })
})
