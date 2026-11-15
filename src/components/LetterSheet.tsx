import { page } from '../content/page'
import { letterText } from 'virtual:letter'

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
    <div className="mx-auto -mt-28 w-full max-w-2xl px-4 sm:-mt-36 sm:px-6">
      <div className="relative">
        {/* the sheet underneath, so it reads as paper rather than a card */}
        <div
          aria-hidden="true"
          className="absolute inset-0 translate-x-1.5 translate-y-2 rounded-[3px] border border-rule bg-sheet-back"
        />

        <article className="relative rounded-[3px] border border-rule bg-sheet px-7 py-9 shadow-[0_1px_1px_rgba(23,19,15,0.03),0_28px_56px_-36px_rgba(23,19,15,0.4)] sm:px-12 sm:py-12">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule pb-4">
            <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint">
              {page.letterhead.from}
            </span>
            <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint">
              {page.letterhead.date}
            </span>
          </div>

          <div className="mt-6">
            <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint">To</p>
            <p className="mt-1 font-serif text-[0.9375rem] leading-relaxed text-ink-soft">
              {page.letterhead.to}
            </p>
          </div>

          <p className="mt-6 font-serif text-[1.0625rem] font-semibold leading-snug text-ink">
            {page.letterhead.subject}
          </p>

          <p className="letter-body mt-7">{page.letterhead.salutation}</p>

          <div className="letter-body mt-5 space-y-5">
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
            ) : (
              <p className="italic text-ink-faint">{page.emptyLetterNotice}</p>
            )}
          </div>

          <div className="mt-10 border-t border-rule pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint">
                Signed on the Hedera Consensus Service
              </span>
              <span className="font-mono text-[0.6875rem] text-ink-faint">{letterHash.slice(0, 16)}…</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
