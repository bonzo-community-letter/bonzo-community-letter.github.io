import type { ReactNode } from 'react'
import { isSource, type LetterBlock } from '../lib/letterBlocks'

/**
 * The letter's blocks, drawn on the sheet.
 *
 * `**bold**` and `_italic_` are the only inline markup the letter uses, and they do not
 * nest — a renderer that guessed more would be a renderer that could change the text.
 */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter((part) => part.length > 0)
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          // bold can hold italic — "_advances covering …_" sits inside a bold phrase
          return (
            <strong key={index} className="font-semibold">
              <Inline text={part.slice(2, -2)} />
            </strong>
          )
        }
        if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
          return <em key={index}>{part.slice(1, -1)}</em>
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}

export function LetterBlocks({ blocks }: { blocks: LetterBlock[] }): ReactNode {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading':
            return block.level === 2 ? (
              <h3 key={index} className="!mt-9 font-serif text-[1.375rem] font-semibold leading-snug text-sheet-ink">
                {block.text}
              </h3>
            ) : (
              <h4 key={index} className="!mt-8 font-serif text-[1.0625rem] font-semibold italic leading-snug text-sheet-ink">
                {block.text}
              </h4>
            )
          case 'rule':
            return <hr key={index} className="!mt-10 border-sheet-rule" />
          case 'paragraph': {
            // the numbered source entries are the one place the sheet sets smaller type
            const source = isSource(block)
            return (
              <p
                key={index}
                className={
                  source
                    ? 'break-words text-[0.8125rem] leading-relaxed text-sheet-ink-soft'
                    : undefined
                }
              >
                <Inline text={block.text} />
              </p>
            )
          }
          case 'list': {
            const items = block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="pl-1">
                <Inline text={item.text} />
                {item.sub.length > 0 ? (
                  <div className="mt-2 space-y-2 text-[0.9375rem] leading-relaxed text-sheet-ink-soft">
                    {item.sub.map((sub, subIndex) => (
                      <p key={subIndex}>
                        <Inline text={sub} />
                      </p>
                    ))}
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
