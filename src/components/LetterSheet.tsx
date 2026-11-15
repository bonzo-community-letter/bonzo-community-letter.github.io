import { page } from '../content/page'
import { letterText } from 'virtual:letter'
import { EnvelopeOverlay } from './EnvelopeOverlay'

/**
 * The letter as a page of paper, pulled up so it overlaps the hero — the first
 * thing you read is a letterhead, not a landing page.
 */
export function LetterSheet({ letterHash }: { letterHash: string }) {
  const paragraphs = letterText
    .split('\n\n')
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)

  return (
    <div className="mx-auto -mt-28 w-full max-w-5xl px-4 sm:-mt-36 sm:px-6">
      <div className="relative">
        {/* the sheet underneath, so it reads as paper rather than a card */}
        <div
          aria-hidden="true"
          className="absolute inset-0 translate-x-1.5 translate-y-2 rounded-[3px] border border-sheet-rule bg-sheet-back"
        />

        <article className="relative rounded-[3px] border border-sheet-rule bg-sheet px-7 py-10 shadow-[0_2px_4px_rgba(0,0,0,0.5),0_60px_100px_-60px_rgba(0,0,0,0.95)] sm:min-h-[900px] sm:px-20 sm:py-16 lg:px-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-sheet-rule pb-4">
            <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-sheet-ink-faint">
              {page.letterhead.from}
            </span>
            <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-sheet-ink-faint">
              {page.letterhead.date}
            </span>
          </div>

          <div className="mt-6">
            <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-sheet-ink-faint">To</p>
            <p className="mt-1 font-serif text-[0.9375rem] leading-relaxed text-sheet-ink-soft">
              {page.letterhead.to}
            </p>
          </div>

          <p className="mt-6 font-serif text-[1.0625rem] font-semibold leading-snug text-sheet-ink">
            {page.letterhead.subject}
          </p>

          <p className="letter-body mt-7">{page.letterhead.salutation}</p>

          <div className="letter-body mt-5 space-y-5">
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
            ) : (
              <p className="italic text-sheet-ink-faint">{page.emptyLetterNotice}</p>
            )}
          </div>

          <div className="mt-10 border-t border-sheet-rule pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-sheet-ink-faint">
                Signed on the Hedera Consensus Service
              </span>
              <span className="font-mono text-[0.6875rem] text-sheet-ink-faint">{letterHash.slice(0, 16)}…</span>
            </div>
          </div>
        </article>

        <EnvelopeOverlay />
      </div>
    </div>
  )
}
