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
export function Testimonials({
  signatures,
  sample = false,
}: {
  signatures: readonly Signature[]
  /** `?demo=1`: the entries include invented comments, and the section says so. */
  sample?: boolean
}) {
  const entries = testimonials(signatures)
  if (entries.length === 0) return null

  const count = entries.length

  return (
    <section className="mx-auto w-full max-w-2xl px-4 pb-16 pt-16 sm:px-6">
      <p className="eyebrow">In their words</p>
      <h2 className="mt-2 font-serif text-2xl leading-tight text-ink">
        {sample
          ? 'Sample comments — not signatures'
          : count === 1
            ? 'One signer wrote to the addressees'
            : `${count} signers wrote to the addressees`}
      </h2>

      {/* One column, in the order the mirror returned them. A grid would put a 512-byte
          comment beside a two-line one and leave a hole in whichever cell the row did
          not fill; columns would pack the cards but scramble the order the dates tell.
          A single measure of about 70 characters keeps a long comment readable and a
          short one honest. */}
      <ul className="mt-7">
        {entries.map((entry) => (
          <li key={entry.accountId} className="border-t border-rule py-5 first:pt-4 last:pb-0">
            <blockquote className="font-serif text-[1.0625rem] leading-relaxed text-ink">
              {entry.comment}
            </blockquote>
            <p className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
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
