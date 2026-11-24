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
    <header className="hero-height border-b border-rule bg-hero">
      <div className="mx-auto w-full max-w-5xl px-6 pt-10 pb-24 text-center sm:pt-20 sm:pb-32">
        <p className="eyebrow-mark">{page.eyebrow}</p>

        <h1 className="mx-auto mt-3 max-w-[18ch] font-serif text-[2.25rem] leading-[1.06] tracking-tight text-ink sm:mt-4 sm:text-6xl min-[360px]:text-[2.75rem] min-[360px]:leading-[1.04]">
          {page.title}
        </h1>

        <p className="mx-auto mt-5 max-w-[52ch] text-[0.9375rem] leading-relaxed text-ink-soft sm:mt-6 sm:text-base">
          {page.from.note}
        </p>

        <div className="mt-7 sm:mt-10">
          <p className="eyebrow" style={{ fontSize: '0.875rem' }}>To</p>
          <ul className="mt-3 flex flex-col items-center gap-y-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-center sm:gap-x-6 sm:gap-y-2">
            {addressees.map((addressee, i) => (
              <Fragment key={addressee.name}>
                {/* Seven names never share a line inside max-w-5xl, and letting the
                    last one wrap alone reads as an accident. Break after the Hedera
                    side instead: the three Hedera entities above, the four that follow
                    below, and the stack on a phone is unaffected. */}
                {i === 3 ? <li aria-hidden="true" className="hidden basis-full sm:block" /> : null}
                <li className="flex items-center gap-2.5">
                  {addressee.logoSrc ? (
                    <img
                      src={addressee.logoSrc}
                      alt=""
                      className="h-4 w-auto shrink-0 opacity-80 grayscale"
                    />
                  ) : null}
                  <span className="font-serif text-base leading-snug text-ink min-[360px]:text-lg">{addressee.name}</span>
                </li>
              </Fragment>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-xs text-ink-faint tnum sm:mt-10">
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
