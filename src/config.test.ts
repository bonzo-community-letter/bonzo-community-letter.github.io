import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The read-only switch is a build-time value, so the only way to test it is to set it and
 * load the module again. Anything but "true" leaves the page live — a half-set variable in
 * a repository must not quietly turn a campaign off.
 */
describe('read-only mode', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const load = async () => await import('./config')

  it('is off when the variable is unset', async () => {
    vi.stubEnv('VITE_READ_ONLY', '')
    expect((await load()).config.readOnly).toBe(false)
  })

  it('is on when the variable says true', async () => {
    vi.stubEnv('VITE_READ_ONLY', 'true')
    expect((await load()).config.readOnly).toBe(true)
  })

  it('accepts the word in any case, with space around it', async () => {
    vi.stubEnv('VITE_READ_ONLY', '  TRUE  ')
    expect((await load()).config.readOnly).toBe(true)
  })

  it('is not turned on by anything else', async () => {
    for (const value of ['1', 'yes', 'on', 'false']) {
      vi.resetModules()
      vi.stubEnv('VITE_READ_ONLY', value)
      expect((await load()).config.readOnly, value).toBe(false)
    }
  })

  it('closes signing', async () => {
    vi.stubEnv('VITE_READ_ONLY', 'true')
    vi.stubEnv('VITE_HCS_TOPIC_ID_MAINNET', '0.0.1234')
    vi.stubEnv('VITE_WALLETCONNECT_PROJECT_ID', 'project')
    const { signingOpen } = await load()
    expect(signingOpen).toBe(false)
  })
})
