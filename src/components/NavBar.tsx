import type { WalletApi } from '../hooks/useWallet'
import { config } from '../config'
import { standingOf } from '../lib/affected'
import { prefetchWallet } from '../lib/wallet'
import { Spinner } from './Spinner'
import { Tip } from './Tip'

/**
 * A thin bar, not a website chrome: the letter is the page. It carries the one
 * action that belongs on every screen — connecting the wallet that will sign —
 * and says which network it signs on, because that is the fact a signer most
 * needs to see and the easiest one to get wrong.
 *
 * The badge beside the account is the answer to "what am I here": it is decided from
 * the connected account, not from anything the reader picks, so it appears the moment
 * the wallet connects and cannot be set to the wrong one.
 */
/** What a dead control says in read-only mode, wherever it is asked. */
const READ_ONLY_PANEL =
  'The letter is currently read-only and still being drafted. As soon as the campaign starts, you will be able to connect and sign the letter.'

export function NavBar({ wallet, onConnect }: { wallet: WalletApi; onConnect: () => void }) {
  const connected = wallet.status === 'connected' && wallet.accountId !== null
  const busy = wallet.status === 'connecting' || wallet.status === 'restoring'
  const label = connected ? wallet.accountId : busy ? 'Connecting…' : 'Connect'
  const standing = connected && wallet.accountId ? standingOf(wallet.accountId) : null

  const accountButton = (
    <button
      type="button"
      onClick={() => {
        if (!config.readOnly) onConnect()
      }}
      onPointerEnter={config.readOnly ? undefined : prefetchWallet}
      onFocus={config.readOnly ? undefined : prefetchWallet}
      aria-haspopup={config.readOnly ? undefined : 'dialog'}
      aria-disabled={config.readOnly || undefined}
      aria-describedby={config.readOnly ? 'connect-read-only' : undefined}
      className={`flex items-center gap-1.5 rounded-full border border-rule px-2.5 py-2 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ink-soft sm:gap-2 sm:px-4 sm:py-1.5 sm:text-[0.6875rem] sm:tracking-[0.14em] ${
        config.readOnly
          ? 'cursor-not-allowed opacity-55'
          : 'transition-colors hover:border-accent hover:text-ink'
      }`}
    >
      {connected ? (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
      ) : busy ? (
        <Spinner className="text-accent" />
      ) : null}
      <span className={connected ? 'font-mono text-[0.6875rem] tracking-normal normal-case' : ''}>
        {label}
      </span>
    </button>
  )

  return (
    <header className="sticky top-0 z-40 border-b border-rule/70 bg-page/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* One line, and it gives way first: with a wallet connected the bar carries the
            badge and a full account id beside it, and a wrapped title in a 56px bar reads
            as a broken header. On a phone the name truncates rather than pushing them off. */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="min-w-0 truncate whitespace-nowrap font-serif text-[0.8125rem] leading-none tracking-wide text-ink-soft sm:text-[0.9375rem]">
            Bonzo Community Letter
          </span>
          {/* The page says what mode it is in, next to its own name — not only in the tooltip
              of a button someone may never touch. */}
          {config.readOnly ? (
            <Tip id="read-only-marker" side="below" width={300} panel={READ_ONLY_PANEL}>
              <span
                tabIndex={0}
                aria-describedby="read-only-marker"
                className="shrink-0 cursor-help whitespace-nowrap rounded-full border border-accent/50 px-1.5 py-0.5 text-[0.4375rem] font-semibold uppercase tracking-[0.1em] text-accent focus:outline-none focus-visible:border-accent sm:text-[0.5rem]"
              >
                Read-only mode
              </span>
            </Tip>
          ) : null}
        </div>

        {/* items-stretch, not items-center: the badge takes its height from the button it
            sits beside, at every breakpoint, instead of guessing the same padding and
            landing nine pixels short. */}
        <div className="flex shrink-0 items-stretch gap-3">
          <span className="hidden self-center text-[0.625rem] uppercase tracking-[0.16em] text-ink-faint sm:inline">
            {config.network}
          </span>
          {/* A word in the accent colour, not a pill: the bar already carries one bordered
              control, and a second outline beside it read as two buttons. */}
          {standing ? (
            <span
              className={`self-center whitespace-nowrap text-[0.5rem] font-semibold uppercase tracking-[0.06em] sm:text-[0.5625rem] sm:tracking-[0.1em] ${
                standing === 'affected' ? 'text-accent' : 'text-accent/75'
              }`}
            >
              {standing === 'affected' ? 'Affected User' : 'Supporter'}
            </span>
          ) : null}
          {/* Only while read-only: in the live page the button opens the dialog, and a panel
              explaining that it does not would be a lie. */}
          {config.readOnly ? (
            <Tip
              id="connect-read-only"
              side="below"
              width={300}
              panel={READ_ONLY_PANEL}
            >
              {accountButton}
            </Tip>
          ) : (
            accountButton
          )}
        </div>
      </div>
    </header>
  )
}
