import { Fragment } from 'react'
import { addressees } from '../content/addressees'
import { page } from '../content/page'

/**
 * The hero is the front of the envelope: title, what this is about, and who it goes
 * to. The sender is not here — it is written on the envelope's flap, as on a real
 * one, and only appears in the document for screen readers.
 */
export function Hero({ signatureCount }: { signatureCount: number | null }) {
  return (
    <header className="hero-height border-b border-rule bg-hero/80">
      <div className="mx-auto w-full max-w-5xl px-6 pt-10 pb-24 text-center sm:pt-20 sm:pb-32">
        <p className="eyebrow-mark">{page.eyebrow}</p>

        <h1 className="mx-auto mt-3 max-w-[18ch] font-serif text-[2.25rem] leading-[1.06] tracking-tight text-ink sm:mt-4 sm:text-6xl min-[360px]:text-[2.75rem] min-[360px]:leading-[1.04]">
          {page.title}
        </h1>

        {/* `text-balance`: a standfirst that ends on a single word reads as an accident. */}
        <p className="mx-auto mt-5 max-w-[52ch] text-balance text-[0.9375rem] leading-relaxed text-ink-soft sm:mt-6 sm:text-base">
          {page.from.note}
        </p>

        <div className="mt-7 sm:mt-10">
          <p className="eyebrow" style={{ fontSize: '0.875rem' }}>To</p>
          {/* Two columns on a phone: seven names stacked read as a wall, and the block
              is short enough that the envelope stays in view. `w-fit` keeps the columns
              as narrow as their longest name instead of stretching to the page. */}
          <ul className="mx-auto mt-3 grid w-fit max-w-full grid-cols-2 gap-x-6 gap-y-1.5 text-left sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-center sm:gap-x-6 sm:gap-y-2 sm:text-center">
            {addressees.map((addressee, i) => (
              <Fragment key={addressee.name}>
                {/* Seven names never share a line inside max-w-5xl, and letting the
                    last one wrap alone reads as an accident. Break after the Hedera
                    side instead: the three Hedera entities above, the four that follow
                    below, and the stack on a phone is unaffected. */}
                {i === 3 ? <li aria-hidden="true" className="hidden basis-full sm:block" /> : null}
                <li className="flex items-start gap-2.5">
                  {/* the marks come back on a wider screen: in a two-column block on a
                      phone they cost the width the longer names need */}
                  {addressee.logoSrc ? (
                    <img
                      src={addressee.logoSrc}
                      alt=""
                      className="hidden h-4 w-auto shrink-0 opacity-80 grayscale sm:block"
                    />
                  ) : null}
                  <span className="font-serif text-[0.875rem] leading-snug text-ink min-[360px]:text-[0.9375rem] sm:text-lg">
                    {addressee.name}
                  </span>
                </li>
              </Fragment>
            ))}
          </ul>
        </div>

        {/* On a phone this line sat under the envelope's fold, cost a line of the hero
            and told the reader what the footer already says. */}
        <p className="mt-6 hidden text-xs text-ink-faint tnum sm:mt-10 sm:block">
          {page.status}
          {signatureCount !== null
            ? ` · ${signatureCount.toLocaleString('en-US')} ${signatureCount === 1 ? 'signature' : 'signatures'}`
            : null}
        </p>

        {/* the sender lives on the envelope's flap, which is decorative — keep the
            words in the document for anyone who cannot see it */}
        <p className="sr-only">From {page.from.name}</p>
      </div>
    </header>
  )
}
