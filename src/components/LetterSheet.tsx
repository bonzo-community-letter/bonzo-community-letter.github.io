import { useLayoutEffect, useRef, useState } from 'react'
import { config } from '../config'
import { page } from '../content/page'
import { ENVELOPE, HERO_CLEARANCE, envelopeOpensOnScroll, envelopeRestingGeometry, envelopeTravel } from './EnvelopeOverlay'
import { signatureBy, type Signature } from '../lib/hcs'
import { localSignature } from '../lib/signedHere'
import { ENVELOPE_VIEW } from './EnvelopeSvg'
import { Tip } from './Tip'
import { DonateDialog } from './DonateDialog'
import { SignDialog } from './SignDialog'
import type { WalletApi } from '../hooks/useWallet'
import { letterText, subject } from 'virtual:letter'

/** How far through the flap's travel the paper should reach the fold. */
const CROSSING = 0.62
/** On a phone the envelope is already open, so there is no crossing to aim for: the
 *  paper stands out of the opening, its letterhead — the From line — clear of the fold.
 *  Negative: it starts above the fold, not inside it. */
const OPEN_DEPTH = -0.5

/**
 * The sheet starts inside the envelope, not at its opening: the gap above it is the
 * distance it travels to come out, and the envelope covers it until the page scrolls.
 *
 * That distance cannot be a fixed number of pixels — the envelope's height follows the
 * viewport (588:363), and the fold sits a fixed fraction of it above the bottom edge.
 * So the gap is measured: place the paper where it is `CROSSING` of the reveal away
 * from meeting the fold — or, where the envelope starts open, a little inside it.
 */
function useStartDepth(
  wrapper: React.RefObject<HTMLDivElement | null>,
  sheet: React.RefObject<HTMLDivElement | null>,
): void {
  // The fold is captured once per viewport width and then left alone. iOS moves the
  // visible viewport as the address bar collapses — firing resize, and resizing the body
  // — and re-measuring each time made the letter shift under the reader while scrolling.
  const anchor = useRef<{ width: number; fold: number } | null>(null)

  useLayoutEffect(() => {
    const place = (): void => {
      const box = wrapper.current
      const paper = sheet.current
      // The fold comes from the overlay's own arithmetic, not from the element: the box
      // carries a transform that grows with the scroll position, so measuring it while the
      // reader is scrolled describes a fold already on its way out of the viewport. That is
      // what moved the letter when the page was reloaded halfway down.
      const geometry = envelopeRestingGeometry()
      if (!box || !paper || !geometry) return

      const { fold, boxWidth } = geometry
      const bodyHeight = ENVELOPE_VIEW.bodyHeightFor(boxWidth)
      const width = window.innerWidth
      if (!anchor.current || anchor.current.width !== width) {
        // a fact about the resting page: no scroll term, so it survives a reload
        anchor.current = { width, fold }
      }

      // how far the fold itself descends per pixel of scroll
      const foldPerScroll = (envelopeTravel() / ENVELOPE.exit) * bodyHeight
      const depth = envelopeOpensOnScroll(width)
        ? CROSSING * ENVELOPE.reveal * (1 + foldPerScroll)
        : OPEN_DEPTH * bodyHeight
      let target = anchor.current.fold + depth

      // The envelope says where the paper *may* be; the hero says where it may not
      // go. On a narrow screen the address list alone is taller than the space the
      // envelope geometry leaves above the fold, so the sheet used to start on top
      // of the hero's last line. Measure the hero's own text and stay below it.
      const hero = document.querySelector<HTMLElement>('header.hero-height')
      if (hero) {
        const lines = Array.from(hero.querySelectorAll<HTMLElement>('h1, p, ul, .eyebrow-mark')).filter(
          (el) => !el.classList.contains('sr-only') && el.getBoundingClientRect().height > 4,
        )
        if (lines.length > 0) {
          const contentBottom =
            Math.max(...lines.map((el) => el.getBoundingClientRect().bottom)) + window.scrollY
          target = Math.max(target, contentBottom + HERO_CLEARANCE)
        }
      }

      // a margin, not a spacer: on a phone the paper starts above the wrapper's top edge
      const top = box.getBoundingClientRect().top + window.scrollY
      paper.style.marginTop = `${Math.round(target - top)}px`
    }

    place()
    // the first run can happen before the stylesheet lands, when the hero is still
    // unlaid-out; measure again once the layout exists and whenever the hero's height
    // changes. Not the body: on iOS it resizes as the address bar collapses, and
    // re-placing there made the letter shift under the reader.
    const frame = requestAnimationFrame(place)
    const observer = new ResizeObserver(place)
    const hero = document.querySelector('header')
    if (hero) observer.observe(hero)
    const timers = [setTimeout(place, 120), setTimeout(place, 600)]
    window.addEventListener('resize', place)
    window.addEventListener('orientationchange', place)
    // a restored scroll position arrives after this effect ran, and fires no resize
    window.addEventListener('pageshow', place)
    void document.fonts?.ready.then(place)

    return () => {
      cancelAnimationFrame(frame)
      timers.forEach(clearTimeout)
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('orientationchange', place)
      window.removeEventListener('pageshow', place)
    }
  }, [wrapper, sheet])
}

/**
 * The letter as a page of paper, pulled up so it overlaps the hero — the first
 * thing you read is a letterhead, not a landing page.
 *
 * It sits at z-20: above the envelope's standing flap and below its body, so it can
 * emerge from the envelope as the page scrolls.
 */
export function LetterSheet({
  letterHash,
  wallet,
  signatureCount,
  signatures,
  onConnect,
  onSigned,
}: {
  letterHash: string
  wallet: WalletApi
  signatureCount: number | null
  signatures: readonly Signature[]
  onConnect: () => void
  onSigned: () => void
}) {
  const wrapper = useRef<HTMLDivElement | null>(null)
  const sheet = useRef<HTMLDivElement | null>(null)
  const [signOpen, setSignOpen] = useState(false)
  const [donateOpen, setDonateOpen] = useState(false)
  // Signing is the one thing on this page that needs a wallet; without one the button is
  // disabled instead of opening a dialog that can only ask for the same thing.
  const connected = wallet.status === 'connected' && wallet.accountId !== null
  // One signature per account: the button says so before the dialog has to.
  const alreadySigned =
    signatureBy(signatures, wallet.accountId) !== null ||
    localSignature(wallet.accountId, subject, letterHash, config.network) !== null
  useStartDepth(wrapper, sheet)

  const paragraphs = letterText
    .split('\n\n')
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)

  return (
    <div ref={wrapper} className="relative z-20 mx-auto -mt-28 flow-root w-full max-w-5xl px-7 sm:-mt-36 sm:px-6">
      <div ref={sheet} className="relative">
        {/* the sheet underneath, so it reads as paper rather than a card */}
        <div
          aria-hidden="true"
          className="absolute inset-0 translate-x-1.5 translate-y-2 rounded-[3px] border border-sheet-rule bg-sheet-back"
        />

        <article className="relative rounded-[3px] border border-sheet-rule bg-sheet px-7 py-10 shadow-[0_2px_4px_rgba(0,0,0,0.5),0_60px_100px_-60px_rgba(0,0,0,0.95)] sm:min-h-[900px] sm:px-20 sm:py-16 lg:px-24">
          {/* Stacked on a phone: side by side, the date took the room the sender needed
              and the line broke after "the", leaving "Exploit" alone. */}
          <div className="flex flex-col items-start gap-y-1 border-b border-sheet-rule pb-4 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-6">
            <span className="whitespace-nowrap text-[0.6875rem] uppercase tracking-[0.08em] text-sheet-ink-faint sm:tracking-[0.14em]">
              {/* the same words as on the envelope's flap, with the label the flap has */}
              From: {page.from.name}
            </span>
            <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-sheet-ink-faint">
              {page.letterhead.date}
            </span>
          </div>

          <div className="mt-6">
            <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-sheet-ink-faint">To</p>
            <ul className="mt-1 font-serif text-[0.9375rem] leading-relaxed text-sheet-ink-soft">
              {page.letterhead.to.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>

          <p className="mt-6 font-serif text-[1.0625rem] font-semibold leading-snug text-sheet-ink">
            {page.letterhead.subject}
          </p>

          <p className="letter-body mt-7">{page.letterhead.salutation}</p>

          <div className="letter-body mt-5 space-y-5">
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
            ) : (
              <p className="italic text-sheet-ink-faint">{page.emptyLetterNotice}</p>
            )}
          </div>

          {/* The letter keeps one action, nothing else: the rest lives in the dialog.
              Signing needs a wallet. Without one the button says so on itself — a tooltip
              over it — rather than printing a line of explanation under the letter, where it
              read as part of the text. `aria-disabled` rather than `disabled`: a disabled
              button takes no focus and no tap, and then the tooltip could never open on a
              phone, which is the one place it is needed. */}
          {/* Both actions sit at the right edge, the quiet one first: the letter's own
              action is the last thing the eye reaches, and Donate is an offer, not a step. */}
          {/* A phone stacks it: the count centred on its own line, the two actions on the next,
              side by side and centred under it. From sm the old row returns — count at the left
              edge, actions at the right. */}
          <div className="mt-10 flex flex-col items-center gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-x-4 sm:gap-y-3">
            {/* The count, in the one hand the page reserves for it, on the same line as the
                actions — mr-auto holds it at the left edge and lets it wrap on its own above
                them on a phone, where the two buttons already take the width. */}
            {signatureCount !== null && signatureCount > 0 ? (
              <a
                href="#personal-messages"
                className="text-center font-script text-[1.3125rem] leading-[1.2] text-ink-blue transition-colors hover:text-accent min-[340px]:text-[1.5625rem] min-[380px]:text-[1.75rem] sm:mr-auto sm:text-left sm:text-[1.75rem] lg:text-[2rem]"
              >
                Signed by {signatureCount.toLocaleString('en-US')} Hedera{' '}
                {signatureCount === 1 ? 'account' : 'accounts'}
              </a>
            ) : null}
            <div className="flex items-center justify-center gap-3">
            {config.treasuryAccountId ? (
              <Tip
                id="donate-hint"
                side="above"
                panel="Donate HBAR to the campaign to help raise awareness by posting this letter with up to 100 TPS on the hashgraph."
              >
                <button
                  type="button"
                  onClick={() => setDonateOpen(true)}
                  aria-haspopup="dialog"
                  aria-describedby="donate-hint"
                  className="whitespace-nowrap rounded-sm border border-sheet-rule px-3 py-2 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-sheet-ink transition-colors hover:border-accent hover:text-accent sm:px-5 sm:text-[0.6875rem] sm:tracking-[0.14em]"
                >
                  Donate
                </button>
              </Tip>
            ) : null}
            {/* The tooltip says what the button will do in whichever state it is in: with no
                wallet the action is connecting one, with a wallet it is the signature itself. */}
            <Tip
              id="sign-needs-wallet"
              side="above"
              panel={
                connected
                  ? 'Sign this letter with your wallet on the Hedera Consensus Service as a sign of support.'
                  : 'Connect a wallet to sign.'
              }
            >
              <button
                type="button"
                onClick={() => {
                  if (connected) setSignOpen(true)
                }}
                aria-disabled={!connected}
                aria-haspopup="dialog"
                aria-describedby="sign-needs-wallet"
                className={`whitespace-nowrap rounded-sm border px-3 py-2 text-[0.625rem] font-semibold uppercase tracking-[0.1em] transition-colors sm:px-5 sm:text-[0.6875rem] sm:tracking-[0.14em] ${
                  connected
                    ? 'border-sheet-ink bg-sheet-ink text-sheet hover:border-accent hover:bg-accent'
                    : 'cursor-not-allowed border-sheet-rule bg-transparent text-sheet-ink-faint'
                }`}
              >
                {alreadySigned ? 'You have signed' : 'Sign the Letter'}
              </button>
            </Tip>
            </div>
          </div>

          <div className="mt-8 border-t border-sheet-rule pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-sheet-ink-faint">
                Signed on the Hedera Consensus Service
              </span>
              <span className="font-mono text-[0.6875rem] text-sheet-ink-faint">{letterHash.slice(0, 16)}…</span>
            </div>
          </div>
        </article>
      </div>

      <DonateDialog open={donateOpen} onClose={() => setDonateOpen(false)} />

      <SignDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        wallet={wallet}
        letterHash={letterHash}
        count={signatureCount}
        signatures={signatures}
        onConnect={onConnect}
        onSigned={onSigned}
      />
    </div>
  )
}
