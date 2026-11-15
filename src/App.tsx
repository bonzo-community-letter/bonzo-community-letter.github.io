import { useEffect, useState } from 'react'
import { config, signingOpen } from './config'
import { LETTER_ID, letterIsDraft, letterText } from './content/letter'
import { useSignatures } from './hooks/useSignatures'
import { sha256Hex } from './lib/hcs'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-neutral-200 py-2">
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="text-right font-mono text-sm text-neutral-900">{value}</dd>
    </div>
  )
}

/**
 * Scaffold shell only.
 *
 * This page exists to prove the plumbing works locally and in CI: the build,
 * the base path for GitHub Pages, the config, and the read path from the
 * Hedera mirror node. Content, layout and visual design are not defined yet.
 */
export function App() {
  const [letterHash, setLetterHash] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void sha256Hex(letterText).then((hash) => {
      if (active) setLetterHash(hash)
    })
    return () => {
      active = false
    }
  }, [])

  const signatures = useSignatures(letterHash, LETTER_ID)

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
        defined yet — this shell exists to make the build, the deploy path and the signature reader
        testable before any of that is decided.
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
        <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-neutral-500">Configuration</h2>
        <dl>
          <Row label="HCS topic id" value={config.topicId || 'not set'} />
          <Row label="WalletConnect project id" value={config.walletConnectProjectId ? 'set' : 'not set'} />
          <Row label="contact url" value={config.contactUrl || 'not set'} />
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-neutral-500">Letter</h2>
        <dl>
          <Row label="letter id" value={LETTER_ID} />
          <Row label="text" value={letterText.length > 0 ? `${letterText.length} chars` : 'not written yet'} />
          <Row label="draft" value={letterIsDraft ? 'yes' : 'no'} />
          <Row label="sha-256 of text" value={letterHash ? `${letterHash.slice(0, 24)}…` : 'computing…'} />
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-neutral-500">Signatures</h2>
        <dl>
          <Row label="read from mirror node" value={signatureValue} />
        </dl>
      </section>

      <p className="mt-10 border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-500">
        Where things go: <span className="font-mono">src/content/</span> for the letter and copy,{' '}
        <span className="font-mono">src/lib/</span> for the HCS layer,{' '}
        <span className="font-mono">src/hooks/</span> for data access,{' '}
        <span className="font-mono">.github/workflows/</span> for CI and deploy. Details in README.md.
      </p>
    </main>
  )
}
