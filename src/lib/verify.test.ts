import { describe, expect, it } from 'vitest'
import { fetchTransactionResult, mirrorTransactionId, waitForTransactionResult } from './hcs'

const TX = '0.0.1234@1700000000.000000000'
const DASHED = '0.0.1234-1700000000-000000000'

/** A fetch that answers each call from a queue and records the URLs it was given. */
function scripted(answers: (string | null)[], status = 200): { fetchImpl: typeof fetch; calls: string[] } {
  const calls: string[] = []
  let index = 0
  const fetchImpl = (async (url: string | URL | Request) => {
    calls.push(String(url))
    const result = answers[Math.min(index, answers.length - 1)]
    index += 1
    if (status !== 200) return { ok: false, status, json: async () => ({}) }
    return {
      ok: true,
      status: 200,
      json: async () => ({ transactions: result === null ? [] : [{ result }] }),
    }
  }) as unknown as typeof fetch
  return { fetchImpl, calls }
}

describe('mirrorTransactionId', () => {
  it('turns the wallet spelling into the dashed one the mirror accepts', () => {
    expect(mirrorTransactionId(TX)).toBe(DASHED)
  })

  it('leaves an id alone when it is already dashed', () => {
    expect(mirrorTransactionId(DASHED)).toBe(DASHED)
  })

  it('trims what a wallet hands back', () => {
    expect(mirrorTransactionId(` ${TX} `)).toBe(DASHED)
  })
})

describe('fetchTransactionResult', () => {
  it('returns the network’s own status word', async () => {
    const { fetchImpl, calls } = scripted(['SUCCESS'])
    await expect(fetchTransactionResult('mainnet', TX, fetchImpl)).resolves.toBe('SUCCESS')
    expect(calls[0]).toContain(DASHED)
    expect(calls[0]).toContain('mainnet-public.mirrornode.hedera.com')
  })

  it('reports a refusal as a word, not as an absence', async () => {
    const { fetchImpl } = scripted(['INVALID_SIGNATURE'])
    await expect(fetchTransactionResult('mainnet', TX, fetchImpl)).resolves.toBe('INVALID_SIGNATURE')
  })

  it('answers null while the mirror has not indexed it', async () => {
    const { fetchImpl } = scripted([null])
    await expect(fetchTransactionResult('mainnet', TX, fetchImpl)).resolves.toBeNull()
  })

  it('answers null on an HTTP error rather than throwing', async () => {
    const { fetchImpl } = scripted(['SUCCESS'], 404)
    await expect(fetchTransactionResult('mainnet', TX, fetchImpl)).resolves.toBeNull()
  })

  it('does not ask the mirror about an id it cannot spell', async () => {
    const { fetchImpl, calls } = scripted(['SUCCESS'])
    await expect(fetchTransactionResult('mainnet', 'not-an-id', fetchImpl)).resolves.toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('reads the testnet mirror when the build is on testnet', async () => {
    const { fetchImpl, calls } = scripted(['SUCCESS'])
    await fetchTransactionResult('testnet', TX, fetchImpl)
    expect(calls[0]).toContain('testnet.mirrornode.hedera.com')
  })
})

describe('waitForTransactionResult', () => {
  it('returns the result as soon as the mirror has it', async () => {
    const { fetchImpl } = scripted([null, null, 'SUCCESS'])
    const result = await waitForTransactionResult('mainnet', TX, {
      fetchImpl,
      sleep: async () => {},
    })
    expect(result).toBe('SUCCESS')
  })

  it('gives up quietly when the budget runs out', async () => {
    const { fetchImpl, calls } = scripted([null])
    const result = await waitForTransactionResult('mainnet', TX, {
      fetchImpl,
      budgetMs: 3_000,
      delayMs: 1_000,
      sleep: async () => {},
    })
    expect(result).toBeNull()
    expect(calls).toHaveLength(3)
  })

  it('stops polling when the caller aborts', async () => {
    const { fetchImpl, calls } = scripted([null])
    const result = await waitForTransactionResult('mainnet', TX, {
      fetchImpl,
      budgetMs: 10_000,
      delayMs: 1_000,
      sleep: async () => {},
      aborted: () => calls.length > 0,
    })
    expect(result).toBeNull()
    expect(calls).toHaveLength(1)
  })
})
