import { page } from '../content/page'

export function SiteFooter() {
  return (
    // Opaque, in the nav's colour: the wall of ids stops at the footer rather than
    // running under the last line of the page.
    <footer className="border-t border-rule/60 bg-page">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-4 py-7 sm:px-6">
        <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint">{page.status}</span>
        <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint">
          Signed on the Hedera Consensus Service
        </span>
      </div>
    </footer>
  )
}
