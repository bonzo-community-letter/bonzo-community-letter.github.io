import { config, signingOpen } from './config'
import { useSignatures } from './hooks/useSignatures'
import { MAX_COMMENT_BYTES, buildSignature, topicMemo } from './lib/hcs'
import { isDraft, letterBytes, letterHash, letterText, subject } from 'virtual:letter'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-neutral-200 py-2">
      <dt className="shrink-0 text-sm text-neutral-500">{label}</dt>
      <dd className="break-all text-right font-mono text-sm text-neutral-900">{value}</dd>
    </div>
  )
}

/**
 * Scaffold shell only.
 *
 * Exists to prove the plumbing: the build, the base path for GitHub Pages, the
 * build-time letter hash, and the read path from the Hedera mirror node.
 * Content, layout and visual design are not defined yet.
 */
export function App() {
  const signatures = useSignatures({ subject, letterHash })

  // what a signer would submit right now — no wallet involved, just the bytes
  const draft = buildSignature({ accountId: '0.0.1234', subject, letterHash })

  const signatureValue =
    signatures.status === 'closed'
      ? 'not reading (no topic)'
      : signatures.status === 'loading'
        ? 'reading…'
        : signatures.status === 'error'
          ? `error: ${signatures.error ?? 'unknown'}`
          : `${signatures.signatures.length}`

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-neutral-900">
      <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">Scaffold</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Open letter — project skeleton</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        Structure and plumbing only. The letter text, the page layout and the visual design are not
        defined yet. The hash below is computed from <code>src/content/letter.ts</code> at build time.
      </p>

      <section className="mt-8">
        <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-neutral-500">Runtime</h2>
        <dl>
          <Row label="mode" value={import.meta.env.PROD ? 'production build' : 'dev server'} />
          <Row label="base path" value={import.meta.env.BASE_URL} />
          <Row label="network" value={config.network} />
          <Row label="signing" value={signingOpen ? 'open' : 'closed'} />
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-neutral-500">Letter</h2>
        <dl>
          <Row label="subject" value={subject} />
          <Row label="text" value={letterText.length > 0 ? `${letterBytes} bytes` : 'not written yet'} />
          <Row label="draft" value={isDraft ? 'yes' : 'no'} />
          <Row label="sha-256 (build time)" value={letterHash} />
          <Row label="topic memo" value={topicMemo(subject, letterHash)} />
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-neutral-500">
          Signature message
        </h2>
        <p className="mb-2 text-xs leading-relaxed text-neutral-500">
          What a wallet would submit — the hash of the letter, never the letter itself. Optional comment,
          at most {MAX_COMMENT_BYTES} bytes.
        </p>
        <pre className="overflow-x-auto rounded border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-800">
          <code>{draft.ok ? draft.encoded : `invalid: ${draft.errors.join('; ')}`}</code>
        </pre>
        <p className="mt-2 text-xs text-neutral-500">
          {draft.ok ? `${draft.bytes} of 1024 bytes used` : 'fix the inputs above'}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-neutral-500">Configuration</h2>
        <dl>
          <Row label="HCS topic id" value={config.topicId || 'not set'} />
          <Row label="WalletConnect project id" value={config.walletConnectProjectId ? 'set' : 'not set'} />
          <Row label="contact url" value={config.contactUrl || 'not set'} />
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-neutral-500">Signatures</h2>
        <dl>
          <Row label="read from mirror node" value={signatureValue} />
        </dl>
      </section>

      <p className="mt-10 border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-500">
        Where things go: <span className="font-mono">src/content/</span> for the letter,{' '}
        <span className="font-mono">build/letter-hash.ts</span> for the build-time hash,{' '}
        <span className="font-mono">src/lib/</span> for the HCS contract,{' '}
        <span className="font-mono">.github/workflows/</span> for CI and deploy. Details in README.md.
      </p>
    </main>
  )
}
