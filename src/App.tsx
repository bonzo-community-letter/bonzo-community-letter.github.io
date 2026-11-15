import { DevStatus } from './components/DevStatus'
import { Hero } from './components/Hero'
import { LetterSheet } from './components/LetterSheet'
import { useSignatures } from './hooks/useSignatures'
import { letterHash, subject } from 'virtual:letter'

export function App() {
  const signatures = useSignatures({ subject, letterHash })
  const signatureCount = signatures.status === 'ready' ? signatures.signatures.length : null

  return (
    <div className="min-h-dvh bg-paper">
      <Hero signatureCount={signatureCount} />
      <main>
        <LetterSheet letterHash={letterHash} />
        <DevStatus state={signatures} />
      </main>
    </div>
  )
}
