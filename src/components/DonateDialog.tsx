import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { config } from '../config'
import { hashscanAccountUrl } from '../lib/hcs'
import { CAMPAIGN_GOAL_USD, CAMPAIGN_TPS, MILESTONES, formatPercent, formatUsd, shareOf } from '../lib/campaign'
import { useTreasuryBalance } from '../hooks/useTreasuryBalance'

/**
 * Where a donation goes, and what it is spent on.
 *
 * The page has no backend and signs nothing for anyone: the reader's own wallet sends
 * the transfer, and all this dialog can do is name the account and show it as a code.
 * That is why the account id is printed in full as well — a QR code is a convenience,
 * and a reader who cannot scan it still has to be able to read the address.
 *
 * The QR carries the bare account id, which is what the account *is*. It is not a
 * payment link: no wallet scans an account id and fills in a transfer, and pretending
 * otherwise with a made-up URI would be worse than saying so.
 */
export function DonateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const account = config.treasuryAccountId
  const treasury = useTreasuryBalance()

  useEffect(() => {
    if (!open) return

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    const overflow = document.body.style.overflow

    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLElement>('button, a[href]')?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [open, onClose])

  // Dark modules on paper, not the other way round: an inverted code is a code many
  // scanners refuse, and this one is read off a phone screen at arm's length.
  useEffect(() => {
    if (!open || !account) return
    let live = true
    void QRCode.toDataURL(account, {
      margin: 1,
      width: 240,
      errorCorrectionLevel: 'M',
      color: { dark: '#1a1714ff', light: '#f4efe3ff' },
    })
      .then((url) => {
        if (live) setQr(url)
      })
      .catch(() => {
        if (live) setQr(null)
      })
    return () => {
      live = false
    }
  }, [open, account])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  if (!open || !account) return null

  // Portalled, and at the same z as the signature dialog: rendered in place it would sit
  // inside the letter sheet's stacking context, which is below the envelope overlay — the
  // dialog would come up behind the paper.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-page/80 backdrop-blur-sm"
        tabIndex={-1}
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="donate-title"
        className="relative m-3 max-h-[85dvh] w-full max-w-md overflow-y-auto border border-rule bg-hero p-6 shadow-2xl shadow-black/60 sm:m-0"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="eyebrow">{config.network} network</p>
        </div>
        <h2 id="donate-title" className="mt-2 font-serif text-2xl leading-tight text-ink">
          Make a donation
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          The campaign aims to increase Hedera’s mainnet TPS temporarily to {CAMPAIGN_TPS} TPS for
          at least 24 h, better 48 h, and ideally 72 h. To increase the TPS, we send 1 tinybar per
          transaction to Hedera’s staking rewards account (
          <span className="font-mono text-ink">0.0.800</span>). We hope that this increase in the TPS
          will draw attention to this open letter, since every transaction memo will link to it.
        </p>

        <dl className="mt-4 grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1.5 border-y border-rule/60 py-3 text-xs">
          {MILESTONES.map((milestone, index) => (
            <Fragment key={milestone.hours}>
              <dt className="text-ink-faint">
                Milestone {index + 1} · {milestone.hours} h at {CAMPAIGN_TPS} TPS
              </dt>
              <dd className="text-right font-mono text-ink tabular-nums">{formatUsd(milestone.usd)}</dd>
            </Fragment>
          ))}
        </dl>

        {treasury ? (
          <p className="mt-3 text-[0.6875rem] uppercase tracking-[0.12em] text-ink-faint">
            Raised so far <span className="text-ink tabular-nums">{formatUsd(treasury.usd)}</span>{' '}
            of <span className="tabular-nums">{formatUsd(CAMPAIGN_GOAL_USD)}</span> (
            <span className="tabular-nums">{formatPercent(shareOf(treasury.usd))}</span>)
          </p>
        ) : null}

        <div className="mt-5 flex justify-center">
          {qr ? (
            <img
              src={qr}
              alt={`QR code for the treasury account ${account}`}
              width={240}
              height={240}
              className="h-[144px] w-[144px] rounded-sm border border-rule sm:h-[168px] sm:w-[168px]"
            />
          ) : (
            <div className="flex h-[144px] w-[144px] items-center justify-center rounded-sm border border-rule text-center text-[0.625rem] leading-tight text-ink-faint sm:h-[168px] sm:w-[168px]">
              QR code unavailable
            </div>
          )}
        </div>

        <p className="mt-4 text-[0.625rem] uppercase tracking-[0.14em] text-ink-faint">Treasury account</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <a
            href={hashscanAccountUrl(config.network, account)}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-mono text-sm text-ink underline decoration-rule underline-offset-4 transition-colors hover:text-ink-soft hover:decoration-accent"
          >
            {account}
          </a>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(account).then(
                () => setCopied(true),
                () => setCopied(false),
              )
            }}
            className="shrink-0 rounded-sm border border-rule px-2 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ink-faint transition-colors hover:border-accent hover:text-ink"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          Any amount helps to give this campaign visibility. Thank you!
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint hover:text-ink-soft"
        >
          Close
        </button>
      </div>
    </div>,
    document.body,
  )
}
