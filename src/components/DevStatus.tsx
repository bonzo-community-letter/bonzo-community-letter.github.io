import { NETWORKS, config, signingOpen } from '../config'
import type { SignatureState } from '../hooks/useSignatures'
import { MAX_COMMENT_BYTES, buildSignature, prettyPayload } from '../lib/hcs'
import { AFFECTED_COUNT, CLAIM_LIST_COUNT, ROOT, ROOT_FROM_CONFIG } from '../lib/affected'
import { isDraft, letterBytes, letterHash, letterText, subject } from 'virtual:letter'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-rule/70 py-1.5">
      <dt className="shrink-0 text-ink-faint">{label}</dt>
      <dd className="break-all text-right font-mono text-ink-soft">{value}</dd>
    </div>
  )
}

/**
 * Build-time facts about the letter and the payload a signer would submit.
 * Collapsed by default: this is for development, not for readers.
 */
export function DevStatus({ state }: { state: SignatureState }) {
  const draft = buildSignature({ accountId: '0.0.1234', subject, letterHash })

  const signatureValue =
    state.status === 'closed'
      ? 'not reading (no topic)'
      : state.status === 'loading'
        ? 'reading…'
        : state.status === 'error'
          ? `error: ${state.error ?? 'unknown'}`
          : `${state.signatures.length}`

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-20 pt-10 sm:px-6">
      <details className="rounded border border-rule bg-white/[0.04] px-4 py-3 text-xs text-ink-soft">
        <summary className="cursor-pointer select-none text-ink-faint">Developer status</summary>

        <dl className="mt-3">
          <Row label="mode" value={import.meta.env.PROD ? 'production build' : 'dev server'} />
          <Row label="base path" value={import.meta.env.BASE_URL} />
          <Row label="network" value={`${config.network} · ${config.profile.chainId}`} />
          <Row label="mirror node" value={config.profile.mirrorBase} />
          <Row label="signing" value={signingOpen ? 'open' : 'closed'} />
          <Row label="subject" value={subject} />
          <Row label="text" value={letterText.length > 0 ? `${letterBytes} bytes` : 'not written yet'} />
          <Row label="draft" value={isDraft ? 'yes' : 'no'} />
          <Row label="sha-256" value={letterHash} />
          <Row label="HCS topic" value={config.topicId || 'not set'} />
          <Row label="topic · testnet" value={NETWORKS.testnet.topicId || 'not set'} />
          <Row label="topic · mainnet" value={NETWORKS.mainnet.topicId || 'not set'} />
          {/* The commitment behind every badge: the list ships, the root is what a reader
              checks it against. Shown here so it can be copied without dev tools. */}
          <Row label="affected set" value={`${AFFECTED_COUNT} accounts (${CLAIM_LIST_COUNT} on the claim list)`} />
          <Row label="affected root" value={`${ROOT}${ROOT_FROM_CONFIG ? '' : ' (generated)'}`} />
          <Row label="WalletConnect id" value={config.walletConnectProjectId ? 'set' : 'not set'} />
          <Row label="signatures read" value={signatureValue} />
          {state.truncated ? (
            <Row label="older messages" value="unread — the read stopped at its page bound" />
          ) : null}
        </dl>

        <p className="mt-4 text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint">
          Message a signer would submit
        </p>
        <pre className="mt-2 overflow-x-auto rounded border border-rule bg-black/30 p-3 font-mono text-[0.6875rem] leading-relaxed text-ink-soft">
          <code>{draft.ok ? prettyPayload(draft.payload) : `invalid: ${draft.errors.join('; ')}`}</code>
        </pre>
        <p className="mt-1 text-ink-faint">
          {draft.ok ? `${draft.bytes} of 1024 bytes · comment up to ${MAX_COMMENT_BYTES} bytes` : '—'}
        </p>
      </details>
    </section>
  )
}
