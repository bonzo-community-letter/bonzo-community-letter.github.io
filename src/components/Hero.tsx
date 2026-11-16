import { addressees } from '../content/addressees'
import { page } from '../content/page'

/**
 * The hero is the front of the envelope: title, what this is about, and who it goes
 * to. The sender is not here — it is written on the envelope's flap, as on a real
 * one, and only appears in the document for screen readers.
 */
export function Hero({ signatureCount }: { signatureCount: number | null }) {
  return (
    <header className="border-b border-rule bg-hero">
      <div className="mx-auto w-full max-w-5xl px-6 pt-14 pb-24 text-center sm:pt-20 sm:pb-32">
        <p className="eyebrow">{page.eyebrow}</p>

        <h1 className="mx-auto mt-4 max-w-[18ch] font-serif text-[2.75rem] leading-[1.04] tracking-tight text-ink sm:text-6xl">
          {page.title}
        </h1>

        <p className="mx-auto mt-6 max-w-[52ch] text-base leading-relaxed text-ink-soft">
          {page.from.note}
        </p>

        <div className="mt-10">
          <p className="eyebrow" style={{ fontSize: '0.875rem' }}>To</p>
          <ul className="mt-3 flex flex-wrap items-baseline justify-center gap-x-6 gap-y-2">
            {addressees.map((addressee) => (
              <li key={addressee.name} className="flex items-center gap-2.5">
                {addressee.logoSrc ? (
                  <img
                    src={addressee.logoSrc}
                    alt=""
                    className="h-4 w-auto shrink-0 opacity-80 grayscale"
                  />
                ) : null}
                <span className="font-serif text-lg leading-snug text-ink">{addressee.name}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-10 text-xs text-ink-faint">
          {page.status}
          {signatureCount !== null ? ` · ${signatureCount.toLocaleString('en-US')} signatures` : null}
        </p>

        {/* the sender lives on the envelope's flap, which is decorative — keep the
            words in the document for anyone who cannot see it */}
        <p className="sr-only">From {page.from.name}</p>
      </div>
    </header>
  )
}
