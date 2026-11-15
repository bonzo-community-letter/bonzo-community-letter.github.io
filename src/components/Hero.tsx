import { addressees } from '../content/addressees'
import { page } from '../content/page'

export function Hero({ signatureCount }: { signatureCount: number | null }) {
  return (
    <header className="border-b border-rule bg-hero">
      <div className="mx-auto w-full max-w-5xl px-6 pt-16 pb-36 text-center sm:pt-24 sm:pb-44">
        <p className="eyebrow">{page.eyebrow}</p>

        <h1 className="mt-4 font-serif text-[2.75rem] leading-[1.04] tracking-tight text-ink sm:text-6xl">
          {page.title}
        </h1>

        <p className="mx-auto mt-5 max-w-[52ch] text-[0.9375rem] leading-relaxed text-ink-soft sm:text-base">
          <span className="font-serif text-[1.125rem] italic text-ink">{page.subtitle.lead}</span>{' '}
          {page.subtitle.rest}
        </p>

        <div className="mt-11 flex flex-wrap items-baseline justify-center gap-x-6 gap-y-3">
          <span className="font-serif text-2xl italic leading-none text-ink">To</span>
          <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
            {addressees.map((addressee) => (
              <li key={addressee.name}>
                {addressee.logoSrc ? (
                  <img
                    src={addressee.logoSrc}
                    alt={addressee.name}
                    className="h-5 w-auto opacity-70 grayscale"
                  />
                ) : (
                  <span className="text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                    {addressee.wordmark}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-9 text-xs text-ink-faint">
          {page.status}
          {signatureCount !== null ? ` · ${signatureCount.toLocaleString('en-US')} signatures` : null}
        </p>
      </div>
    </header>
  )
}
