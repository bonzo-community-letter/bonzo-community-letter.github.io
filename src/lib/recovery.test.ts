import { describe, expect, it } from 'vitest'
import {
  NO_RATE_COLOUR,
  clampRate,
  recoveryColour,
  recoveryFraction,
  recoveryInkColour,
  recoveryLabel,
  lossLine,
} from './recovery'

/** Pull the hue out of an `hsl(…)` string. */
function hueOf(colour: string): number {
  const match = /hsl\(([\d.]+)/.exec(colour)
  expect(match).not.toBeNull()
  return Number(match?.[1])
}

describe('recoveryColour', () => {
  it('starts red, passes amber and ends green', () => {
    expect(hueOf(recoveryColour(0))).toBeLessThan(12)
    expect(hueOf(recoveryColour(50))).toBeGreaterThan(35)
    expect(hueOf(recoveryColour(50))).toBeLessThan(50)
    expect(hueOf(recoveryColour(100))).toBeGreaterThan(120)
  })

  it('moves in one direction as the rate rises', () => {
    const hues = [0, 10, 25, 50, 75, 90, 100].map((rate) => hueOf(recoveryColour(rate)))
    for (let i = 1; i < hues.length; i++) {
      expect(hues[i]!).toBeGreaterThan(hues[i - 1]!)
    }
  })

  it('gives silence its own colour, not red', () => {
    expect(recoveryColour(null)).toBe(NO_RATE_COLOUR)
    expect(hueOf(recoveryColour(null))).not.toBeCloseTo(hueOf(recoveryColour(0)), 0)
  })

  it('clamps rather than wrapping round the scale', () => {
    expect(recoveryColour(-40)).toBe(recoveryColour(0))
    expect(recoveryColour(140)).toBe(recoveryColour(100))
  })
})

describe('recoveryLabel', () => {
  it('rounds to a whole percent', () => {
    expect(recoveryLabel(8.8)).toBe('9')
    expect(recoveryLabel(8.4)).toBe('8')
    expect(recoveryLabel(0)).toBe('0')
    expect(recoveryLabel(100)).toBe('100')
  })

  it('says a dash when nothing was stated — never a zero', () => {
    expect(recoveryLabel(null)).toBe('–')
  })
})

describe('recoveryFraction', () => {
  it('is the rate as a share of the circle', () => {
    expect(recoveryFraction(0)).toBe(0)
    expect(recoveryFraction(25)).toBe(0.25)
    expect(recoveryFraction(100)).toBe(1)
  })

  it('is zero when nothing was stated, so no arc is drawn', () => {
    expect(recoveryFraction(null)).toBe(0)
  })
})

describe('clampRate', () => {
  it('keeps a rate inside the scale and treats nonsense as nothing recovered', () => {
    expect(clampRate(42)).toBe(42)
    expect(clampRate(-1)).toBe(0)
    expect(clampRate(101)).toBe(100)
    expect(clampRate(Number.NaN)).toBe(0)
  })
})

describe('recoveryInkColour', () => {
  it('is lighter than the arc, so the number reads on a dark page', () => {
    for (const rate of [0, 50, 100]) {
      const lightness = Number(/% ([\d.]+)%/.exec(recoveryInkColour(rate))?.[1])
      const arcLightness = Number(/% ([\d.]+)%/.exec(recoveryColour(rate))?.[1])
      expect(lightness).toBeGreaterThan(arcLightness)
    }
  })

  it('keeps the ring\'s hue, so number and arc agree', () => {
    for (const rate of [0, 25, 50, 75, 100]) {
      expect(hueOf(recoveryInkColour(rate))).toBeCloseTo(hueOf(recoveryColour(rate)), 0)
    }
  })

  it('gives silence a readable brown', () => {
    expect(recoveryInkColour(null)).toBe('hsl(26 30% 64%)')
  })
})

describe('lossLine', () => {
  it('states what is still missing, not what came back', () => {
    expect(lossLine(8.8)).toBe('91% of net supply lost')
    expect(lossLine(0)).toBe('100% of net supply lost')
    expect(lossLine(100)).toBe('0% of net supply lost')
  })

  it('names silence as silence, not as a total loss', () => {
    expect(lossLine(null)).toBe('Losses not stated')
  })

  it('rounds to a whole percent, like the ring', () => {
    expect(lossLine(8.4)).toBe('92% of net supply lost')
    expect(lossLine(8.6)).toBe('91% of net supply lost')
  })
})
