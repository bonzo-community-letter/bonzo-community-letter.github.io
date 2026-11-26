/**
 * The letter's markup, parsed into blocks the sheet can draw, and cut into pages.
 *
 * The subset is deliberately tiny — `##`, `###`, `---`, `**bold**`, `_italic_`, `1.` and
 * `-` — because the letter is prose with a handful of headings, not a document format. A
 * parser that understood more would be a parser that could quietly change the text.
 *
 * Pages are cut between blocks, never inside one, and a heading is never left as the last
 * thing on a page: a page that ends on "What happened?" has answered nothing.
 */

export type LetterItem = {
  /** The item's own text, markup included. */
  text: string
  /** The paragraphs and bullets that belong to it, indented under it. */
  sub: string[]
}

export type LetterBlock =
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: LetterItem[] }
  | { kind: 'rule' }

const HEADING = /^(#{2,3})\s+(.*)$/
const ORDERED = /^(\d+)\.\s+(.*)$/
const BULLET = /^[-*]\s+(.*)$/
const RULE = /^-{3,}$/

/** True for the numbered source entries, which the sheet sets smaller than the letter. */
export const isSource = (block: LetterBlock): boolean =>
  block.kind === 'paragraph' && /^\*\*\d+\*\*\s+—/.test(block.text)

export function parseLetter(text: string): LetterBlock[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: LetterBlock[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean; items: LetterItem[] } | null = null

  const lastItem = (): LetterItem | null => {
    if (!list) return null
    return list.items.length > 0 ? list.items[list.items.length - 1] ?? null : null
  }

  const flushParagraph = () => {
    const joined = paragraph.join(' ').trim()
    if (joined) {
      const item = lastItem()
      if (item) item.sub.push(joined)
      else blocks.push({ kind: 'paragraph', text: joined })
    }
    paragraph = []
  }
  const flushList = () => {
    flushParagraph()
    if (list && list.items.length > 0) blocks.push({ kind: 'list', ordered: list.ordered, items: list.items })
    list = null
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const trimmed = line.trim()

    if (trimmed === '') {
      flushParagraph()
      continue
    }

    const heading = HEADING.exec(trimmed)
    if (heading) {
      flushList()
      const hashes = heading[1] ?? ''
      blocks.push({ kind: 'heading', level: hashes.length === 2 ? 2 : 3, text: (heading[2] ?? '').trim() })
      continue
    }

    if (RULE.test(trimmed)) {
      flushList()
      blocks.push({ kind: 'rule' })
      continue
    }

    const ordered = ORDERED.exec(trimmed)
    const bullet = BULLET.exec(trimmed)
    if (ordered || bullet) {
      // a bullet inside a numbered item belongs to that item, not to a list of its own
      if (bullet && list && list.ordered) {
        flushParagraph()
        lastItem()?.sub.push(`– ${(bullet[1] ?? '').trim()}`)
        continue
      }
      // a second item of the same kind continues the list, even when a blank line and a
      // continuation paragraph sit between them — that is how this letter is written
      if (!list || list.ordered !== Boolean(ordered)) flushList()
      const text = (ordered ? ordered[2] : bullet?.[1]) ?? ''
      if (!list) list = { ordered: Boolean(ordered), items: [] }
      list.items.push({ text: text.trim(), sub: [] })
      continue
    }

    paragraph.push(trimmed)
  }

  flushList()
  return blocks
}

/** Roughly what a block costs on the page, in characters. */
const weigh = (block: LetterBlock): number => {
  switch (block.kind) {
    case 'heading':
      return 120
    case 'paragraph':
      return block.text.length
    case 'list':
      return block.items.reduce((sum, item) => sum + item.text.length + item.sub.join(' ').length, 0)
    case 'rule':
      return 40
  }
}

/**
 * Cut the blocks into pages of at most `budget` characters.
 *
 * A block is never split, so a page can run a little over; a heading is moved to the next
 * page rather than left hanging at the foot of one. A single block longer than the budget
 * gets a page to itself — better a long page than a broken paragraph.
 */
export function paginate(blocks: LetterBlock[], budget = 2600): LetterBlock[][] {
  const pages: LetterBlock[][] = []
  let page: LetterBlock[] = []
  let used = 0

  const close = () => {
    // a heading as the last block belongs to what follows it
    const last = page[page.length - 1]
    const trailing = page.length > 1 && last !== undefined && last.kind === 'heading'
    if (trailing) {
      const heading = page.pop()!
      if (page.length > 0) pages.push(page)
      page = [heading]
      used = weigh(heading)
    } else if (page.length > 0) {
      pages.push(page)
      page = []
      used = 0
    }
  }

  // A block that would only just fit the next page is taken along instead: a sheet with a
  // third of a page of text on it, followed by a full one, reads as a mistake.
  const MIN_FILL = budget * 0.45

  for (const block of blocks) {
    const cost = weigh(block)
    if (page.length > 0 && used >= MIN_FILL && used + cost > budget) close()
    page.push(block)
    used += cost
  }

  if (page.length > 0) pages.push(page)
  return pages
}
