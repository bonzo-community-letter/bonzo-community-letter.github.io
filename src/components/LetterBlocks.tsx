import { useId, type ReactNode } from 'react'
import type { LetterBlock, LetterSources } from '../lib/letterBlocks'
import { Tip } from './Tip'

/**
 * The letter's blocks, drawn on the sheet.
 *
 * `**bold**`, `_italic_` and `[n]` citations are the only inline markup the letter uses, and
 * they do not nest beyond one level — a renderer that guessed more would be a renderer that
 * could change the text.
 *
 * A citation is not a footnote number pointing at a list forty lines below: the source opens
 * where the claim is, on hover, on focus and on tap. The number stays in the text, because
 * the letter as signed has it there.
 */
function Citation({ number, source }: { number: string; source: string }) {
  const id = useId()
  return (
    <Tip id={id} side="above" width={320} panel={<Inline text={source} sources={new Map()} />}>
      {/* `[N]` in the line, not a superscript: the number carries the accent, the brackets the
          text's own colour, so the citation reads as part of the sentence it belongs to. */}
      <span
        tabIndex={0}
        aria-describedby={id}
        aria-label={`Source ${number}`}
        className="cursor-help whitespace-nowrap focus:outline-none"
      >
        [<span className="text-accent">{number}</span>]
      </span>
    </Tip>
  )
}

function Inline({ text, sources }: { text: string; sources: LetterSources }) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_|\[\d+\])/g).filter((part) => part.length > 0)
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          // bold can hold italic and citations — "_advances covering …_", "…all users[7]**"
          return (
            <strong key={index} className="font-semibold">
              <Inline text={part.slice(2, -2)} sources={sources} />
            </strong>
          )
        }
        if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
          return (
            <em key={index}>
              <Inline text={part.slice(1, -1)} sources={sources} />
            </em>
          )
        }
        const citation = /^\[(\d+)\]$/.exec(part)
        if (citation?.[1]) {
          const source = sources.get(citation[1])
          return source ? (
            <Citation key={index} number={citation[1]} source={source} />
          ) : (
            <span key={index}>{part}</span>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}

export function LetterBlocks({ blocks, sources }: { blocks: LetterBlock[]; sources: LetterSources }): ReactNode {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading':
            return block.level === 2 ? (
              <h3 key={index} className="!mt-8 font-serif text-[1.25rem] font-semibold leading-snug text-sheet-ink">
                {block.text}
              </h3>
            ) : (
              // The closing statement, set the way selected text looks: the site's own
              // selection colours are accent on page, and this is the sentence the reader is
              // meant to leave with.
              // Inline, not a block: the highlight follows the words line by line, the way a
              // selection does, instead of painting a rectangle behind a paragraph.
              <p key={index} className="!mt-9 text-center">
                <span className="box-decoration-clone bg-accent px-1 py-0.5 font-serif text-[1.0625rem] font-semibold leading-[1.6] text-page">
                  {block.text}
                </span>
              </p>
            )
          case 'rule':
            return <hr key={index} className="!mt-9 border-sheet-rule" />
          case 'paragraph':
            return (
              <p key={index}>
                <Inline text={block.text} sources={sources} />
              </p>
            )
          case 'list': {
            const items = block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="pl-1">
                <Inline text={item.text} sources={sources} />
                {item.sub.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {item.sub.map((sub, subIndex) => {
                      // The demands are the point of the list. They get a bar in the accent
                      // colour and the letter's own type size — never smaller than the
                      // paragraph that explains them.
                      const demand = /^\*\*We ask\b/.test(sub)
                      return demand ? (
                        <p key={subIndex} className="border-l-[3px] border-accent pl-3">
                          <Inline text={sub} sources={sources} />
                        </p>
                      ) : (
                        <p key={subIndex} className="text-[0.9375rem] leading-relaxed text-sheet-ink-soft">
                          <Inline text={sub} sources={sources} />
                        </p>
                      )
                    })}
                  </div>
                ) : null}
              </li>
            ))
            return block.ordered ? (
              <ol key={index} className="list-decimal space-y-4 pl-5 marker:text-sheet-ink-faint">
                {items}
              </ol>
            ) : (
              <ul key={index} className="list-disc space-y-2 pl-5 marker:text-sheet-ink-faint">
                {items}
              </ul>
            )
          }
        }
      })}
    </>
  )
}
