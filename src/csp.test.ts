import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The page's Content Security Policy, as it ships.
 *
 * GitHub Pages cannot send headers, so the policy lives in a meta tag and is the only
 * thing standing between a compromised dependency and the page's origin. These tests
 * pin the parts that matter, so a future edit cannot quietly widen them.
 */
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const match = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)
const policy = match?.[1] ?? ''

/** `script-src 'self'` → Map { 'script-src' => ["'self'"] } */
const directives = new Map<string, string[]>(
  policy
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name = '', ...values] = part.split(/\s+/)
      return [name, values] as [string, string[]]
    }),
)

describe('the page CSP', () => {
  it('is present in index.html', () => {
    expect(policy.length).toBeGreaterThan(0)
  })

  it('allows only same-origin scripts and no eval', () => {
    const script = directives.get('script-src') ?? []
    expect(script).toEqual(["'self'"])
    expect(script).not.toContain("'unsafe-inline'")
    expect(script).not.toContain("'unsafe-eval'")
    expect(policy).not.toContain('unsafe-eval')
  })

  it('allows inline styles, which the wallet modal needs', () => {
    expect(directives.get('style-src')).toContain("'unsafe-inline'")
  })

  it('locks down objects, base and forms', () => {
    expect(directives.get('object-src')).toEqual(["'none'"])
    expect(directives.get('base-uri')).toEqual(["'self'"])
    expect(directives.get('form-action')).toEqual(["'self'"])
  })

  it('lets the page reach the mirror node and the wallet relay, and nothing else', () => {
    const connect = directives.get('connect-src') ?? []
    expect(connect).toContain('https://mainnet-public.mirrornode.hedera.com')
    expect(connect).toContain('https://testnet.mirrornode.hedera.com')
    expect(connect).toContain('wss://relay.walletconnect.com')
    // no wildcard, no bare https:
    expect(connect).not.toContain('https:')
    expect(connect).not.toContain('*')
  })
})
