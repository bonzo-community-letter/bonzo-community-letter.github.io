import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  HASHPACK_EXTENSION_ID,
  WalletError,
  connect,
  deepLinkFor,
  describeWalletError,
  findExtension,
  hasStoredSession,
  hasWebCrypto,
  isMobileWalletTarget,
  normalizeAccountId,
  isWalletReturn,
  pollForSession,
  rememberedExtension,
  hasConnectedBefore,
  walletLink,
  withTimeout,
} from './wallet'

const jsonResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response

describe('deepLinkFor', () => {
  it('appends the pairing to a universal link', () => {
    expect(deepLinkFor('https://wallet.example', 'wc:abc@2?relay=x')).toBe(
      'https://wallet.example/wc?uri=wc%3Aabc%402%3Frelay%3Dx',
    )
  })

  it('does not double the slash of a universal link', () => {
    expect(deepLinkFor('https://wallet.example/', 'wc:abc')).toBe(
      'https://wallet.example/wc?uri=wc%3Aabc',
    )
  })

  it('builds a native scheme link with a doubled slash', () => {
    expect(deepLinkFor('hashpack:', 'wc:abc')).toBe('hashpack://wc?uri=wc%3Aabc')
  })

  it('builds the same doubled slash from a scheme written with its slashes', () => {
    expect(deepLinkFor('hashpack://', 'wc:abc')).toBe('hashpack://wc?uri=wc%3Aabc')
    expect(deepLinkFor('kabila-wallet://', 'wc:abc')).toBe('kabila-wallet://wc?uri=wc%3Aabc')
  })

  it('encodes characters that would break the link', () => {
    expect(deepLinkFor('https://wallet.example', 'wc:a b&c')).toBe(
      'https://wallet.example/wc?uri=wc%3Aa%20b%26c',
    )
  })
})

describe('isMobileWalletTarget', () => {
  it('recognises phone and tablet browsers', () => {
    expect(isMobileWalletTarget('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true)
    expect(isMobileWalletTarget('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(true)
    expect(isMobileWalletTarget('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true)
  })

  it('treats a desktop browser as desktop', () => {
    expect(isMobileWalletTarget('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(false)
    expect(isMobileWalletTarget('Mozilla/5.0 (X11; Linux x86_64)')).toBe(false)
  })

  it('is safe without a navigator', () => {
    expect(isMobileWalletTarget('')).toBe(false)
  })
})

describe('normalizeAccountId', () => {
  it('accepts a shard.realm.num account id', () => {
    expect(normalizeAccountId(' 0.0.1234 ')).toBe('0.0.1234')
    expect(normalizeAccountId('0.0.0')).toBe('0.0.0')
  })

  it('rejects anything else', () => {
    expect(normalizeAccountId('0.0')).toBeNull()
    expect(normalizeAccountId('hedera:testnet:0.0.1234')).toBeNull()
    expect(normalizeAccountId('0.0.-1')).toBeNull()
    expect(normalizeAccountId('')).toBeNull()
  })
})

describe('walletLink', () => {
  const projectId = 'pid'
  const listing = (over: Record<string, unknown>) => ({
    listings: {
      a29498d225fa4b13468ff4d6cf4ae0ea4adcbd95f07ce8a843a1dee10b632f3f: over,
    },
  })

  it('prefers the app scheme, which opens the app instead of its website', async () => {
    const link = await walletLink('hashpack', projectId, (async () =>
      jsonResponse(
        listing({ slug: 'hashpack', mobile: { universal: 'https://link.hashpack.app', native: 'hashpack://' } }),
      )) as unknown as typeof fetch)
    expect(link).toBe('hashpack://')
  })

  it('does not follow a universal link — a website is not the wallet', async () => {
    const link = await walletLink('hashpack', projectId, (async () =>
      jsonResponse(listing({ slug: 'hashpack', mobile: { universal: 'https://link.hashpack.app' } }))) as unknown as typeof fetch)
    expect(link).toBeNull()
  })

  it('refuses a native link whose scheme is not that wallet', async () => {
    for (const native of ['javascript:alert(1)//', 'https://evil.example/', 'hashpackk://', 'wc://']) {
      const link = await walletLink('hashpack', projectId, (async () =>
        jsonResponse(listing({ slug: 'hashpack', mobile: { native } }))) as unknown as typeof fetch)
      expect(link).toBeNull()
    }
  })

  it('finds Kabila by its slug, which is not its name', async () => {
    const link = await walletLink('kabila', projectId, (async () =>
      jsonResponse(
        listing({ slug: 'kabila-wallet', mobile: { universal: 'https://wallet.kabila.app', native: 'kabila-wallet://' } }),
      )) as unknown as typeof fetch)
    expect(link).toBe('kabila-wallet://')
  })

  it('falls back to the native scheme', async () => {
    const link = await walletLink('kabila', projectId, (async () =>
      jsonResponse(listing({ slug: 'kabila-wallet', mobile: { native: 'kabila-wallet://' } }))) as unknown as typeof fetch)
    expect(link).toBe('kabila-wallet://')
  })

  it('matches by display name when the slug moved', async () => {
    const link = await walletLink('hashpack', projectId, (async () =>
      jsonResponse(
        listing({ slug: 'hashpack-2', name: 'HashPack', mobile: { native: 'hashpack:' } }),
      )) as unknown as typeof fetch)
    expect(link).toBe('hashpack:')
  })

  it('asks the registry by search, not by slug', async () => {
    let called = ''
    await walletLink('hashpack', projectId, (async (url: string) => {
      called = url
      return jsonResponse({ listings: {} })
    }) as unknown as typeof fetch)
    expect(called).toContain('projectId=pid')
    expect(called).toContain('search=hashpack')
  })

  it('returns null when the registry says no', async () => {
    expect(
      await walletLink('hashpack', projectId, (async () => jsonResponse({}, 500)) as unknown as typeof fetch),
    ).toBeNull()
  })

  it('returns null when the wallet is not in the listing', async () => {
    expect(
      await walletLink('hashpack', projectId, (async () =>
        jsonResponse({ listings: { other: { slug: 'some-other-wallet' } } })) as unknown as typeof fetch),
    ).toBeNull()
  })

  it('returns null when the request throws', async () => {
    expect(
      await walletLink('hashpack', projectId, (async () => {
        throw new Error('offline')
      }) as unknown as typeof fetch),
    ).toBeNull()
  })

  it('does not call out without a project id', async () => {
    let called = false
    const link = await walletLink('hashpack', '', (async () => {
      called = true
      return jsonResponse({})
    }) as unknown as typeof fetch)
    expect(link).toBeNull()
    expect(called).toBe(false)
  })

  it('has no link for the generic WalletConnect option', async () => {
    expect(await walletLink('walletconnect', projectId)).toBeNull()
  })
})

describe('hasStoredSession', () => {
  const setStorage = (value: unknown): void => {
    Object.defineProperty(globalThis, 'localStorage', { value, configurable: true, writable: true })
  }
  const original = (globalThis as { localStorage?: unknown }).localStorage

  afterEach(() => setStorage(original))

  it('is false without storage', () => {
    setStorage(undefined)
    expect(hasStoredSession()).toBe(false)
  })

  it('recognises a walletconnect session in storage', () => {
    setStorage({ 'wc@2:client:0.3//session': '[]' })
    expect(hasStoredSession()).toBe(true)
  })

  it('ignores keys this page did not write', () => {
    setStorage({ 'open-letter:theme': 'dark' })
    expect(hasStoredSession()).toBe(false)
  })

  it('survives a storage that throws', () => {
    setStorage({
      get length(): number {
        throw new Error('blocked')
      },
    })
    expect(hasStoredSession()).toBe(false)
  })
})

describe('hasWebCrypto', () => {
  const original = globalThis.crypto
  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true, writable: true })
  })

  it('is true where crypto.subtle exists', () => {
    expect(hasWebCrypto()).toBe(true)
  })

  it('is false on an insecure origin, where the browser withholds crypto.subtle', () => {
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true, writable: true })
    expect(hasWebCrypto()).toBe(false)
  })

  it('refuses to start a connection without it, instead of hanging', async () => {
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true, writable: true })
    await expect(connect('walletconnect')).rejects.toThrow(/secure connection/)
  })
})

describe('findExtension', () => {
  const withExtensions = (extensions: { id: string; name?: string }[]) =>
    ({ extensions }) as unknown as Parameters<typeof findExtension>[0]

  it('finds HashPack by id', () => {
    expect(findExtension(withExtensions([{ id: 'hashpack', name: 'HashPack' }]), 'hashpack')).toEqual({
      id: 'hashpack',
    })
  })

  it('finds a wallet whose id is not the brand name', () => {
    expect(
      findExtension(withExtensions([{ id: 'ext-42', name: 'Kabila Wallet' }]), 'kabila'),
    ).toEqual({ id: 'ext-42' })
  })

  it('finds HashPack by the id its content script announces', () => {
    expect(
      findExtension(withExtensions([{ id: HASHPACK_EXTENSION_ID, name: 'Some Renamed Wallet' }]), 'hashpack'),
    ).toEqual({ id: HASHPACK_EXTENSION_ID })
  })

  it('ignores extensions that are not the wallet asked for', () => {
    expect(findExtension(withExtensions([{ id: 'blade', name: 'Blade' }]), 'hashpack')).toBeNull()
  })

  it('has no extension for the generic WalletConnect option', () => {
    expect(findExtension(withExtensions([{ id: 'hashpack', name: 'HashPack' }]), 'walletconnect')).toBeNull()
  })

  it('is null when nothing answered the handshake', () => {
    expect(findExtension(withExtensions([]), 'hashpack')).toBeNull()
  })
})

describe('withTimeout', () => {
  it('passes a fast answer through', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, 'late')).resolves.toBe('ok')
  })

  it('rejects with a readable message when the wallet never answers', async () => {
    const pending = new Promise<string>(() => {})
    await expect(withTimeout(pending, 5, 'The wallet did not answer in time.')).rejects.toThrow(
      'The wallet did not answer in time.',
    )
  })

  it('keeps the rejection of the original promise', async () => {
    await expect(withTimeout(Promise.reject(new Error('rejected')), 1000, 'late')).rejects.toThrow(
      'rejected',
    )
  })
})

describe('describeWalletError', () => {
  it('keeps a WalletError message', () => {
    expect(describeWalletError(new WalletError('not_configured', 'Not configured here.'))).toBe(
      'Not configured here.',
    )
  })

  it('turns a wallet rejection into a sentence', () => {
    expect(describeWalletError(new Error('User rejected.'))).toBe(
      'The request was rejected in your wallet.',
    )
    expect(describeWalletError(new Error('User cancelled'))).toBe(
      'The request was rejected in your wallet.',
    )
  })

  it('recognises an expired session', () => {
    expect(describeWalletError(new Error('Session not found'))).toBe(
      'The wallet session expired. Please connect again.',
    )
  })

  it('never leaks a raw message for an unknown failure', () => {
    expect(describeWalletError(new Error('kaboom at line 42'))).toBe(
      'The wallet connection failed. Please try again.',
    )
    expect(describeWalletError(undefined)).toBe('The wallet connection failed. Please try again.')
  })
})

describe('isWalletReturn', () => {
  it('reads the marker a wallet app comes back with', () => {
    expect(isWalletReturn('?wallet=return')).toBe(true)
    expect(isWalletReturn('?foo=1&wallet=return')).toBe(true)
    expect(isWalletReturn('?wallet=other')).toBe(false)
    expect(isWalletReturn('')).toBe(false)
  })
})

describe('pollForSession', () => {
  it('picks up a session that only arrives after the page is up', async () => {
    vi.useFakeTimers()
    try {
      const seen: string[] = []
      let reads = 0
      const stop = pollForSession(
        () => {
          reads += 1
          return reads >= 3 ? { accountId: '0.0.5', network: 'mainnet' as const } : null
        },
        (session) => seen.push(session.accountId),
        { intervalMs: 1_000, budgetMs: 10_000 },
      )
      await vi.advanceTimersByTimeAsync(3_500)
      expect(seen).toEqual(['0.0.5'])
      stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops at its budget instead of watching forever', async () => {
    vi.useFakeTimers()
    try {
      let reads = 0
      const stop = pollForSession(
        () => {
          reads += 1
          return null
        },
        () => undefined,
        { intervalMs: 1_000, budgetMs: 5_000 },
      )
      await vi.advanceTimersByTimeAsync(60_000)
      expect(reads).toBeLessThanOrEqual(6)
      stop()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('the connection marker', () => {
  const withMarker = (value: string | null): void => {
    const store = new Map<string, string>()
    if (value !== null) store.set('treasury.wallet.extension', value)
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, next: string) => void store.set(key, next),
        removeItem: (key: string) => void store.delete(key),
        key: (index: number) => [...store.keys()][index] ?? null,
        get length() {
          return store.size
        },
        clear: () => store.clear(),
      },
    })
  }
  const withoutStorage = (): void => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined })
  }

  it('reads a legacy bare kind as an extension', () => {
    withMarker('hashpack')
    expect(rememberedExtension()).toBe('hashpack')
    expect(hasConnectedBefore()).toBe(true)
    withoutStorage()
  })

  it('knows the road: only an extension road is an extension', () => {
    withMarker('hashpack:extension')
    expect(rememberedExtension()).toBe('hashpack')
    withMarker('hashpack:deep-link')
    expect(rememberedExtension()).toBeNull()
    expect(hasConnectedBefore()).toBe(true)
    withMarker('walletconnect:dialog')
    expect(hasConnectedBefore()).toBe(true)
    withoutStorage()
  })
})
