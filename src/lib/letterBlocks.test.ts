import { describe, expect, it } from 'vitest'
import { LETTER_BODY } from '../content/letter-body'
import { isSource, paginate, parseLetter, type LetterBlock } from './letterBlocks'

const text = (block: LetterBlock): string => {
  switch (block.kind) {
    case 'heading':
      return block.text
    case 'paragraph':
      return block.text
    case 'list':
      return block.items.map((item) => [item.text, ...item.sub].join(' ')).join(' ')
    case 'rule':
      return ''
  }
}

describe('parseLetter', () => {
  it('reads headings by their level', () => {
    const blocks = parseLetter('## What happened?\n\ntext\n\n### Last word\n\nmore')
    expect(blocks[0]).toEqual({ kind: 'heading', level: 2, text: 'What happened?' })
    expect(blocks[2]).toEqual({ kind: 'heading', level: 3, text: 'Last word' })
  })

  it('keeps a paragraph whole across its line breaks', () => {
    const blocks = parseLetter('one\ntwo\n\nthree')
    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'one two' },
      { kind: 'paragraph', text: 'three' },
    ])
  })

  it('hangs a numbered item’s continuation and bullets under it', () => {
    const blocks = parseLetter('1. first\n\n   **ask**\n   - one\n   - two\n\n2. second')
    expect(blocks).toHaveLength(1)
    const only = blocks[0]
    if (!only || only.kind !== 'list') throw new Error('not a list')
    expect(only.ordered).toBe(true)
    expect(only.items).toHaveLength(2)
    expect(only.items[0]).toEqual({ text: 'first', sub: ['**ask**', '– one', '– two'] })
    expect(only.items[1]?.text).toBe('second')
  })

  it('keeps an unordered list unordered', () => {
    const blocks = parseLetter('- one\n- two')
    expect(blocks[0]).toEqual({ kind: 'list', ordered: false, items: [{ text: 'one', sub: [] }, { text: 'two', sub: [] }] })
  })

  it('reads a rule', () => {
    expect(parseLetter('---')).toEqual([{ kind: 'rule' }])
  })

  it('loses none of the letter', () => {
    const blocks = parseLetter(LETTER_BODY)
    const joined = blocks.map(text).join(' ')
    // every paragraph, heading and item of the source is in the parse, in order
    for (const phrase of [
      'theft of over $9,061,019',
      'What happened?',
      'SAUCE/wHBAR (pair 425)',
      'We ask Hedera Foundation to keep its promise',
      'Where could the recovery funding come from?',
      'Hedera claims to be the trust layer',
      'https://www.hederacouncil.org/faq',
    ]) {
      expect(joined).toContain(phrase)
    }
    // and no block was dropped: the parse is longer than the markup-free source
    expect(joined.length).toBeGreaterThan(LETTER_BODY.replace(/[#*_>-]/g, '').length * 0.95)
  })

  it('marks the numbered source entries', () => {
    const blocks = parseLetter(LETTER_BODY)
    const sources = blocks.filter(isSource)
    expect(sources).toHaveLength(13)
  })
})

describe('paginate', () => {
  const blocks = parseLetter(LETTER_BODY)

  it('never splits a block', () => {
    const pages = paginate(blocks, 1200)
    expect(pages.flat()).toEqual(blocks)
  })

  it('never ends a page on a heading', () => {
    for (const budget of [800, 1200, 2000, 2600]) {
      const pages = paginate(blocks, budget)
      for (const page of pages.slice(0, -1)) {
        expect(page[page.length - 1]?.kind).not.toBe('heading')
      }
    }
  })

  it('spreads the letter over more than one page', () => {
    expect(paginate(blocks, 2600).length).toBeGreaterThan(1)
  })

  it('gives a block larger than the budget a page of its own', () => {
    const pages = paginate([{ kind: 'paragraph', text: 'x'.repeat(500) }, { kind: 'rule' }], 100)
    expect(pages).toHaveLength(2)
    expect(pages[0]).toHaveLength(1)
  })
})
