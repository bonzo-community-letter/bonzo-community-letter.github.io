import { useCallback, useState } from 'react'
import { ConnectDialog } from './components/ConnectDialog'
import { DevStatus } from './components/DevStatus'
import { EnvelopeOverlay } from './components/EnvelopeOverlay'
import { Hero } from './components/Hero'
import { LetterSheet } from './components/LetterSheet'
import { NavBar } from './components/NavBar'
import { SiteFooter } from './components/SiteFooter'
import { closeTips } from './components/Tip'
import { Testimonials } from './components/Testimonials'
import { Backdrop } from './components/Backdrop'
import { sampleSignatures } from './content/demo'
import { useSignatures } from './hooks/useSignatures'
import { config } from './config'
import { uniqueSigners } from './lib/hcs'
import { useWallet } from './hooks/useWallet'
import { isDraft, letterHash, subject } from 'virtual:letter'

export function App() {
  const signatures = useSignatures({ subject, letterHash })
  // One session for the whole page: the top bar and the signature block must never
  // disagree about who is connected.
  const wallet = useWallet()
  const [connectOpen, setConnectOpen] = useState(false)
  const openConnect = useCallback(() => {
    // the tip that explains the button is behind the dialog now, not over it
    closeTips()
    setConnectOpen(true)
  }, [])

  // One signature per account, whoever wrote it: a second message from the same wallet
  // is on the topic for good, but it does not count twice.
  const signers = uniqueSigners(signatures.signatures)
  const signatureCount = signatures.status === 'ready' ? signers.length : null

  // `?demo=1` puts ten sample comments under the letter, so the section can be looked at
  // before it has signers. They are not signatures: the count above ignores them and the
  // section says they are samples.
  //
  // In read-only mode the same reel stands in for the comments: nobody can sign, so the
  // section would otherwise be an empty box on a page that is otherwise complete. It says
  // "(Demo)" in its heading there, because on that page it is not a stand-in for a preview —
  // it is the only content, and a reader must not take invented comments for real ones.
  const demoReel = config.readOnly
  const sample =
    demoReel || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo'))

  return (
    <div className="relative min-h-dvh bg-page">
      {/* the signers' ids, written behind everything the page does not paint over */}
      <Backdrop accounts={(sample ? sampleSignatures(subject, letterHash) : signers).map((s) => s.accountId)} />
      {/*
        No z-index here on purpose. The envelope is drawn in two fixed layers — flap at
        z-10, body at z-30 — with the sheet between them at z-20. A z-index on this
        wrapper would flatten the page into one layer and put the flap in front of the
        letter, so the letter stopped coming out of the envelope.
      */}
      <div className="relative">
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
          {/* The anchor lives here, not on the section: the band returns nothing when no
              signer wrote a comment, and a link to a section that does not exist is a dead
              link — the count can be above zero while nobody has said anything. */}
          <div id="personal-messages" className="scroll-mt-20">
            <Testimonials
              signatures={sample ? [...sampleSignatures(subject, letterHash), ...signers] : signers}
              sample={sample}
              demo={demoReel}
            />
          </div>
          {/* The status box is a build-time instrument, not part of the letter: it exists
              while the text is a draft and leaves with it. */}
          {isDraft ? <DevStatus state={signatures} /> : null}
        </main>
        <SiteFooter />
      </div>
      <ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} wallet={wallet} />
      {/* fixed, in two layers around the letter: flap behind it, body in front */}
      <EnvelopeOverlay />
    </div>
  )
}
