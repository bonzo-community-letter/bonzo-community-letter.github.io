import { useCallback, useState } from 'react'
import { ConnectDialog } from './components/ConnectDialog'
import { DevStatus } from './components/DevStatus'
import { EnvelopeOverlay } from './components/EnvelopeOverlay'
import { Hero } from './components/Hero'
import { LetterSheet } from './components/LetterSheet'
import { NavBar } from './components/NavBar'
import { SiteFooter } from './components/SiteFooter'
import { Testimonials } from './components/Testimonials'
import { sampleSignatures } from './content/demo'
import { useSignatures } from './hooks/useSignatures'
import { uniqueSigners } from './lib/hcs'
import { useWallet } from './hooks/useWallet'
import { letterHash, subject } from 'virtual:letter'

export function App() {
  const signatures = useSignatures({ subject, letterHash })
  // One session for the whole page: the top bar and the signature block must never
  // disagree about who is connected.
  const wallet = useWallet()
  const [connectOpen, setConnectOpen] = useState(false)
  const openConnect = useCallback(() => setConnectOpen(true), [])

  // One signature per account, whoever wrote it: a second message from the same wallet
  // is on the topic for good, but it does not count twice.
  const signers = uniqueSigners(signatures.signatures)
  const signatureCount = signatures.status === 'ready' ? signers.length : null

  // `?demo=1` puts ten sample comments under the letter, so the section can be looked at
  // before it has signers. They are not signatures: the count above ignores them and the
  // section says they are samples.
  const sample = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo')

  return (
    <div className="min-h-dvh bg-page">
      <NavBar wallet={wallet} onConnect={openConnect} />
      <Hero signatureCount={signatureCount} />
      <main>
        <LetterSheet
          letterHash={letterHash}
          wallet={wallet}
          signatureCount={signatureCount}
          signatures={signers}
          onConnect={openConnect}
          onSigned={signatures.refresh}
        />
        <Testimonials
          signatures={sample ? [...sampleSignatures(subject, letterHash), ...signers] : signers}
          sample={sample}
        />
        <DevStatus state={signatures} />
      </main>
      <SiteFooter />
      <ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} wallet={wallet} />
      {/* fixed, in two layers around the letter: flap behind it, body in front */}
      <EnvelopeOverlay />
    </div>
  )
}
