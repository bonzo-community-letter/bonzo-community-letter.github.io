import { testimonials, type Signature } from '../lib/hcs'
import { signedWhen } from '../lib/format'

/**
 * What signers wrote, under the letter.
 *
 * One entry per account — the first comment that account left, since a second
 * signature is ignored by the count and would only repeat the first. Accounts that
 * wrote nothing are not here: a testimonial needs words.
 *
 * It renders nothing at all when there is nothing to show, so a letter with no
 * comments keeps its shape instead of gaining an empty heading.
 */
export function Testimonials({ signatures }: { signatures: readonly Signature[] }) {
  const entries = testimonials(signatures)
  if (entries.length === 0) return null

  const count = entries.length

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-16 sm:px-6">
      <p className="eyebrow">In their words</p>
      <h2 className="mt-2 font-serif text-2xl leading-tight text-ink">
        {count === 1 ? 'One signer wrote to the addressees' : `${count} signers wrote to the addressees`}
      </h2>

      {/* hairline grid: the rule is the background, the cells are the page */}
      <ul className="mt-6 grid gap-px border border-rule bg-rule sm:grid-cols-2">
        {entries.map((entry) => (
          <li key={entry.accountId} className="flex flex-col justify-between bg-page p-5">
            <blockquote className="font-serif text-[1.0625rem] leading-relaxed text-ink">
              {entry.comment}
            </blockquote>
            <p className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-rule/60 pt-3">
              <span className="font-mono text-[0.6875rem] whitespace-nowrap text-ink-soft">
                {entry.accountId}
              </span>
              <span className="text-[0.5625rem] uppercase tracking-[0.16em] text-ink-faint">
                {signedWhen(entry.signedAt, { time: false })}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
