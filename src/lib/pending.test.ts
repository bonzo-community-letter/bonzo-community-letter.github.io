import { describe, expect, it } from 'vitest'
import { PENDING_TTL_MS, clearPending, readPending, savePending, type PendingSubmission } from './pending'

/** A minimal sessionStorage, since these tests run without a DOM. */
function withStorage(run: () => void): void {
  const store = new Map<string, string>()
  const fake = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  const original = (globalThis as { sessionStorage?: unknown }).sessionStorage
  Object.defineProperty(globalThis, 'sessionStorage', { value: fake, configurable: true, writable: true })
  try {
    run()
  } finally {
    Object.defineProperty(globalThis, 'sessionStorage', { value: original, configurable: true, writable: true })
  }
}

const record: PendingSubmission = {
  transactionId: '0.0.1234@1700000000.000000000',
  accountId: '0.0.1234',
  topicId: '0.0.9999',
  network: 'mainnet',
  startedAt: 1_700_000_000_000,
}

describe('pending submission record', () => {
  it('reads back what this tab wrote', () => {
    withStorage(() => {
      savePending(record)
      expect(readPending('mainnet', record.startedAt + 1_000)).toEqual(record)
    })
  })

  it('forgets the attempt once it is cleared', () => {
    withStorage(() => {
      savePending(record)
      clearPending()
      expect(readPending('mainnet', record.startedAt)).toBeNull()
    })
  })

  it('ignores a record from the other network', () => {
    withStorage(() => {
      savePending(record)
      expect(readPending('testnet', record.startedAt)).toBeNull()
    })
  })

  it('ignores an attempt the reader has long moved on from', () => {
    withStorage(() => {
      savePending(record)
      expect(readPending('mainnet', record.startedAt + PENDING_TTL_MS + 1)).toBeNull()
    })
  })

  it('survives a hand-written value that is not a record', () => {
    withStorage(() => {
      savePending({ ...record, transactionId: undefined as unknown as string })
      expect(readPending('mainnet', record.startedAt)).toBeNull()
    })
  })

  it('is a no-op where storage is denied', () => {
    const original = (globalThis as { sessionStorage?: unknown }).sessionStorage
    Object.defineProperty(globalThis, 'sessionStorage', { value: undefined, configurable: true, writable: true })
    try {
      expect(() => savePending(record)).not.toThrow()
      expect(readPending('mainnet', record.startedAt)).toBeNull()
      expect(() => clearPending()).not.toThrow()
    } finally {
      Object.defineProperty(globalThis, 'sessionStorage', { value: original, configurable: true, writable: true })
    }
  })
})
