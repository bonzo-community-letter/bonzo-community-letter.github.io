import type { WalletApi } from '../hooks/useWallet'
import { config } from '../config'
import { prefetchWallet } from '../lib/wallet'
import { Spinner } from './Spinner'

/**
 * A thin bar, not a website chrome: the letter is the page. It carries the one
 * action that belongs on every screen — connecting the wallet that will sign —
 * and says which network it signs on, because that is the fact a signer most
 * needs to see and the easiest one to get wrong.
 */
export function NavBar({ wallet, onConnect }: { wallet: WalletApi; onConnect: () => void }) {
  const connected = wallet.status === 'connected' && wallet.accountId !== null
  const busy = wallet.status === 'connecting' || wallet.status === 'restoring'
  const label = connected ? wallet.accountId : busy ? 'Connecting…' : 'Connect'

  return (
    <header className="sticky top-0 z-40 border-b border-rule/70 bg-page/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <span className="font-serif text-[0.9375rem] leading-none tracking-wide text-ink-soft">
          Open letter
        </span>

        <div className="flex items-center gap-3">
          <span className="hidden text-[0.625rem] uppercase tracking-[0.16em] text-ink-faint sm:inline">
            {config.network}
          </span>
          <button
            type="button"
            onClick={onConnect}
            onPointerEnter={prefetchWallet}
            onFocus={prefetchWallet}
            aria-haspopup="dialog"
            className="flex items-center gap-2 rounded-full border border-rule px-4 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-accent hover:text-ink sm:py-1.5"
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
        </div>
      </div>
    </header>
  )
}
