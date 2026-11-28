import { Fragment } from 'react'
import { addressees } from '../content/addressees'
import { page } from '../content/page'

/**
 * Where each name sits in the phone's two-column block.
 *
 * The list in `content/addressees.ts` is in the order the desktop row wants — the three
 * Hedera entities first, because that line breaks after them. On a phone the same seven
 * names read better in pairs, with the longest one given the full width at the end, so
 * the placement is stated here instead of being derived from the order.
 */
const PHONE_GRID: Record<string, string> = {
  // the two columns face each other across the gap — left column flush right, right
  // column flush left — so the names read as one block rather than two ragged lists
  'Hedera Foundation': 'col-start-1 row-start-1 justify-self-end text-right',
  'Hedera Hashgraph': 'col-start-2 row-start-1 justify-self-start text-left',
  'Hashgraph Foundry': 'col-start-1 row-start-2 justify-self-end text-right',
  'Supra Labs': 'col-start-2 row-start-2 justify-self-start text-left',
  'Entropy Foundation': 'col-start-1 row-start-3 justify-self-end text-right',
  'Bonzo Finance Labs': 'col-start-2 row-start-3 justify-self-start text-left',
  // the full-width name is centred: left-aligned it reads as another left-column entry
  'Bonzo Finance Foundation': 'col-span-2 row-start-4 justify-self-center text-center',
}

/**
 * The hero is the front of the envelope: title, what this is about, and who it goes
 * to. The sender is not here — it is written on the envelope's flap, as on a real
 * one, and only appears in the document for screen readers.
 */
export function Hero({ signatureCount }: { signatureCount: number | null }) {
  return (
    <header className="hero-height border-b border-rule bg-hero/80">
      {/* The funding line is off for now — the marker in the progress bar explains the
          campaign instead. Bringing it back means restoring the split padding below: the
          line costs 28px, and the hero is content-height on a wide screen. */}
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
              is short enough that the envelope stays in view. The order in the content is
              the desktop order; a phone needs a different arrangement, so each name is
              placed explicitly rather than left to row-wise flow. */}
          {/* The block borrows the page's own gutter on a phone: two centred columns of long
              organisation names need those 24px more than the surrounding paragraph does, and
              they are what lets the type stay at 16px instead of dropping to 15. */}
          <div className="-mx-3 sm:mx-0">
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:flex sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-center sm:gap-x-6 sm:gap-y-2 sm:text-center">
            {addressees.map((addressee, i) => (
              <Fragment key={addressee.name}>
                {/* Seven names never share a line inside max-w-5xl, and letting the
                    last one wrap alone reads as an accident. Break after the Hedera
                    side instead: the three Hedera entities above, the four that follow
                    below, and the stack on a phone is unaffected. */}
                {i === 3 ? <li aria-hidden="true" className="hidden basis-full sm:block" /> : null}
                <li className={`flex items-start gap-2.5 ${PHONE_GRID[addressee.name] ?? ''} sm:col-auto sm:row-auto sm:justify-self-auto sm:text-center`}>
                  {/* the marks come back on a wider screen: in a two-column block on a
                      phone they cost the width the longer names need */}
                  {addressee.logoSrc ? (
                    <img
                      src={addressee.logoSrc}
                      alt=""
                      className="hidden h-4 w-auto shrink-0 opacity-80 grayscale sm:block"
                    />
                  ) : null}
                  {/* The largest size that keeps every name on one line, measured at each
                      width: with content-sized columns the two tracks plus the gap have to fit
                      the page, so 16px is the ceiling at 380px and up, 15px below that, 13px
                      on a 320px screen. The spanning name is never the constraint. */}
                  <span className="font-serif text-[0.8125rem] leading-snug text-ink min-[360px]:text-[0.9375rem] min-[380px]:text-base sm:text-lg">
                    {addressee.name}
                  </span>
                </li>
              </Fragment>
            ))}
          </ul>
          </div>
        </div>

        {/* On a phone this line sat under the envelope's fold, cost a line of the hero
            and told the reader what the footer already says. */}
        <p className="mt-6 hidden text-xs text-ink-faint tnum sm:mt-10 sm:block">
          {signatureCount !== null
            ? `${signatureCount.toLocaleString('en-US')} ${signatureCount === 1 ? 'signature' : 'signatures'}`
            : null}
        </p>

        {/* the sender lives on the envelope's flap, which is decorative — keep the
            words in the document for anyone who cannot see it */}
        <p className="sr-only">From {page.from.name}</p>
      </div>
    </header>
  )
}
