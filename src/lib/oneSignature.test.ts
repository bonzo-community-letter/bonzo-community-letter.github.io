import { describe, expect, it } from 'vitest'
import { signatureBy, testimonials, uniqueSigners, type Signature } from './hcs'
import { forgetSignatures, localSignature, rememberSignature } from './signedHere'

const LETTER = 'bonzo-exploit-open-letter'
const HASH = 'a'.repeat(64)

const signature = (accountId: string, overrides: Partial<Signature> = {}): Signature => ({
  accountId,
  subject: LETTER,
  letterHash: HASH,
  signedAt: '2026-11-24T08:38:18.738Z',
  version: 1,
  comment: '',
  sequence: 1,
  consensusTimestamp: '1795509512.357752104',
  payerAccountId: accountId,
  ...overrides,
})

describe('signatureBy', () => {
  it('finds the signature an account already made', () => {
    const list = [signature('0.0.1111'), signature('0.0.2222')]
    expect(signatureBy(list, '0.0.2222')?.accountId).toBe('0.0.2222')
  })

  it('ignores spacing and case, which the wallet may not', () => {
    expect(signatureBy([signature('0.0.2222')], ' 0.0.2222 ')?.accountId).toBe('0.0.2222')
  })

  it('answers null when the account has not signed', () => {
    expect(signatureBy([signature('0.0.1111')], '0.0.3333')).toBeNull()
  })

  it('answers null for no account, or an empty list', () => {
    expect(signatureBy([signature('0.0.1111')], null)).toBeNull()
    expect(signatureBy([signature('0.0.1111')], '')).toBeNull()
    expect(signatureBy([], '0.0.1111')).toBeNull()
  })
})

describe('uniqueSigners', () => {
  it('counts an account once, however often it wrote', () => {
    const list = [signature('0.0.1111'), signature('0.0.2222'), signature('0.0.1111', { sequence: 3 })]
    const kept = uniqueSigners(list)
    expect(kept.map((s) => s.accountId)).toEqual(['0.0.1111', '0.0.2222'])
    expect(kept[0]?.sequence).toBe(1)
  })

  it('is not confused by case or spacing', () => {
    expect(uniqueSigners([signature('0.0.1111'), signature(' 0.0.1111 ')])).toHaveLength(1)
  })

  it('keeps the order the mirror returned', () => {
    const kept = uniqueSigners([signature('0.0.3333'), signature('0.0.1111')])
    expect(kept.map((s) => s.accountId)).toEqual(['0.0.3333', '0.0.1111'])
  })

  it('handles an empty list', () => {
    expect(uniqueSigners([])).toEqual([])
  })
})

describe('testimonials', () => {
  it('takes the first comment each account left', () => {
    const list = [
      signature('0.0.1111', { comment: 'the first word', sequence: 1 }),
      signature('0.0.2222', { comment: 'another voice', sequence: 2 }),
      signature('0.0.1111', { comment: 'a repeat that must not show', sequence: 3 }),
    ]
    expect(testimonials(list).map((entry) => entry.comment)).toEqual(['the first word', 'another voice'])
  })

  it('leaves out accounts that wrote nothing', () => {
    const list = [signature('0.0.1111', { comment: '' }), signature('0.0.2222', { comment: '   ' })]
    expect(testimonials(list)).toEqual([])
  })

  it('trims what it shows', () => {
    expect(testimonials([signature('0.0.1111', { comment: '  spoken plainly  ' })])[0]?.comment).toBe(
      'spoken plainly',
    )
  })

  it('keeps the account and the date with the words', () => {
    const [entry] = testimonials([signature('0.0.1111', { comment: 'hello' })])
    expect(entry).toEqual({
      accountId: '0.0.1111',
      comment: 'hello',
      signedAt: '2026-11-24T08:38:18.738Z',
    })
  })
})

describe('the local record of a signature', () => {
  function withStorage(run: () => void): void {
    const store = new Map<string, string>()
    const fake = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    }
    const original = (globalThis as { localStorage?: unknown }).localStorage
    Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true })
    try {
      forgetSignatures()
      run()
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true, writable: true })
    }
  }

  const entry = {
    accountId: '0.0.2222',
    subject: LETTER,
    letterHash: HASH,
    signedAt: '2026-11-24T08:38:18.738Z',
    network: 'mainnet' as const,
  }

  it('remembers the account that just signed', () => {
    withStorage(() => {
      rememberSignature(entry)
      expect(localSignature('0.0.2222', LETTER, HASH, 'mainnet')?.signedAt).toBe(entry.signedAt)
    })
  })

  it('does not remember a different account', () => {
    withStorage(() => {
      rememberSignature(entry)
      expect(localSignature('0.0.3333', LETTER, HASH, 'mainnet')).toBeNull()
    })
  })

  it('does not carry over to another letter', () => {
    withStorage(() => {
      rememberSignature(entry)
      expect(localSignature('0.0.2222', LETTER, 'b'.repeat(64), 'mainnet')).toBeNull()
    })
  })

  it('does not carry over to another network', () => {
    withStorage(() => {
      rememberSignature(entry)
      expect(localSignature('0.0.2222', LETTER, HASH, 'testnet')).toBeNull()
    })
  })

  it('keeps one record per account and letter, however often it is written', () => {
    withStorage(() => {
      rememberSignature(entry)
      rememberSignature({ ...entry, signedAt: '2026-11-24T09:00:00.000Z' })
      expect(localSignature('0.0.2222', LETTER, HASH, 'mainnet')?.signedAt).toBe('2026-11-24T09:00:00.000Z')
    })
  })

  it('is a no-op where storage is denied', () => {
    const original = (globalThis as { localStorage?: unknown }).localStorage
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true, writable: true })
    try {
      expect(() => rememberSignature(entry)).not.toThrow()
      expect(localSignature('0.0.2222', LETTER, HASH, 'mainnet')).toBeNull()
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true, writable: true })
    }
  })
})
