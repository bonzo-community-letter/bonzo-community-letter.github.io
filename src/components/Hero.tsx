import { addressees } from '../content/addressees'
import { page } from '../content/page'

/**
 * The hero is the letter's address block: title, then From and To side by side.
 * The sheet below picks the same structure up in its letterhead.
 */
export function Hero({ signatureCount }: { signatureCount: number | null }) {
  return (
    <header className="border-b border-rule bg-hero">
      <div className="mx-auto w-full max-w-5xl px-6 pt-16 pb-36 text-center sm:pt-24 sm:pb-44">
        <p className="eyebrow">{page.eyebrow}</p>

        <h1 className="mx-auto mt-4 max-w-[18ch] font-serif text-[2.75rem] leading-[1.04] tracking-tight text-ink sm:text-6xl">
          {page.title}
        </h1>

        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-y-8 text-left sm:grid-cols-[1fr_1px_1fr] sm:gap-x-12">
          <div>
            <p className="eyebrow">From</p>
            <p className="mt-2 font-serif text-xl leading-snug text-ink">{page.from.name}</p>
            <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-ink-soft">{page.from.note}</p>
          </div>

          <div aria-hidden="true" className="hidden bg-rule sm:block" />

          <div className="border-t border-rule pt-8 sm:border-0 sm:pt-0">
            <p className="eyebrow">To</p>
            <ul className="mt-2 space-y-1.5">
              {addressees.map((addressee) => (
                <li key={addressee.name} className="flex items-center gap-2.5">
                  {addressee.logoSrc ? (
                    <img
                      src={addressee.logoSrc}
                      alt=""
                      className="h-4 w-auto shrink-0 opacity-80 grayscale"
                    />
                  ) : null}
                  <span className="font-serif text-xl leading-snug text-ink">{addressee.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-12 text-xs text-ink-faint">
          {page.status}
          {signatureCount !== null ? ` · ${signatureCount.toLocaleString('en-US')} signatures` : null}
        </p>
      </div>
    </header>
  )
}
