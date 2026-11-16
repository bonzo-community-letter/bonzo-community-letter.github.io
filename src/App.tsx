import { DevStatus } from './components/DevStatus'
import { EnvelopeOverlay } from './components/EnvelopeOverlay'
import { Hero } from './components/Hero'
import { LetterSheet } from './components/LetterSheet'
import { SiteFooter } from './components/SiteFooter'
import { useSignatures } from './hooks/useSignatures'
import { letterHash, subject } from 'virtual:letter'

export function App() {
  const signatures = useSignatures({ subject, letterHash })
  const signatureCount = signatures.status === 'ready' ? signatures.signatures.length : null

  return (
    <div className="min-h-dvh bg-page">
      <Hero signatureCount={signatureCount} />
      <main>
        <LetterSheet letterHash={letterHash} />
        <DevStatus state={signatures} />
      </main>
      <SiteFooter />
      {/* fixed, in two layers around the letter: flap behind it, body in front */}
      <EnvelopeOverlay />
    </div>
  )
}
