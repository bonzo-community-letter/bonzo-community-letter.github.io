import { describe, expect, it } from 'vitest'
import { MAX_PAGES, PAGE_SIZE, buildSignature, encodePayload, fetchSignatures, type MirrorMessage } from './hcs'

const HASH = 'a'.repeat(64)
const LETTER = 'bonzo-exploit-open-letter'
const input = { accountId: '0.0.1234', subject: LETTER, letterHash: HASH }

const toB64 = (s: string): string => {
  const bytes = new TextEncoder().encode(s)
  return btoa(String.fromCharCode(...bytes))
}

function message(sequence: number, accountId = '0.0.1234'): MirrorMessage {
  const built = buildSignature({ ...input, accountId, signedAt: '2026-11-15T18:00:00.000Z' })
  if (!built.ok) throw new Error('fixture failed')
  return {
    consensus_timestamp: `${1700000000 + sequence}.000000000`,
    message: toB64(encodePayload(built.payload)),
    payer_account_id: accountId,
    sequence_number: sequence,
  }
}

/** A fetch that answers with whatever the test queued, and records the urls it was given. */
function fakeFetch(pages: { messages: MirrorMessage[]; next?: string | null }[]) {
  const urls: string[] = []
  let call = 0
  const impl = (async (url: string) => {
    urls.push(String(url))
    const page = pages[call] ?? { messages: [], next: null }
    call += 1
    return {
      ok: true,
      status: 200,
      json: async () => ({ messages: page.messages, links: { next: page.next ?? null } }),
    } as unknown as Response
  }) as unknown as typeof fetch
  return { impl, urls }
}

const base = { network: 'mainnet' as const, topicId: '0.0.10965772', subject: LETTER, letterHash: HASH }

describe('fetchSignatures', () => {
  it('asks for a page of a hundred, newest first', async () => {
    const { impl, urls } = fakeFetch([{ messages: [message(1)] }])
    await fetchSignatures({ ...base, fetchImpl: impl })
    expect(urls[0]).toContain(`limit=${PAGE_SIZE}`)
    expect(urls[0]).toContain('order=desc')
  })

  it('follows the cursor until the topic is exhausted', async () => {
    const { impl, urls } = fakeFetch([
      { messages: [message(2), message(1)], next: '/api/v1/topics/0.0.10965772/messages?limit=100&sequenceNumber=lt:2' },
      { messages: [message(3)] },
    ])
    const out = await fetchSignatures({ ...base, fetchImpl: impl })
    expect(urls).toHaveLength(2)
    expect(urls[1]).toContain('/messages?limit=100&sequenceNumber=lt:2')
    // sorted oldest first, whatever order the pages came in
    expect(out.map((s) => s.sequence)).toEqual([1, 2, 3])
  })

  it('stops at its page bound instead of walking a topic forever', async () => {
    const endless = Array.from({ length: MAX_PAGES + 5 }, (_, i) => ({
      messages: [message(i + 1)],
      next: `/api/v1/topics/0.0.10965772/messages?page=${i + 2}`,
    }))
    const { impl, urls } = fakeFetch(endless)
    await fetchSignatures({ ...base, fetchImpl: impl })
    expect(urls).toHaveLength(MAX_PAGES)
  })

  it('asks only for what is newer when it already holds a sequence', async () => {
    const { impl, urls } = fakeFetch([{ messages: [message(9)] }])
    const out = await fetchSignatures({ ...base, sinceSequence: 8, fetchImpl: impl })
    expect(urls[0]).toContain('sequenceNumber=gt:8')
    expect(out.map((s) => s.sequence)).toEqual([9])
  })

  it('treats sequence zero as a real bound', async () => {
    const { impl, urls } = fakeFetch([{ messages: [] }])
    await fetchSignatures({ ...base, sinceSequence: 0, fetchImpl: impl })
    expect(urls[0]).toContain('sequenceNumber=gt:0')
  })

  it('reads nothing without a topic', async () => {
    const { impl, urls } = fakeFetch([])
    expect(await fetchSignatures({ ...base, topicId: '', fetchImpl: impl })).toEqual([])
    expect(urls).toHaveLength(0)
  })

  it('raises when the mirror refuses', async () => {
    const impl = (async () => ({ ok: false, status: 429, json: async () => ({}) })) as unknown as typeof fetch
    await expect(fetchSignatures({ ...base, fetchImpl: impl })).rejects.toThrow('429')
  })
})
