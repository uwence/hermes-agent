import { describe, expect, it } from 'vitest'

import type { ProbeResult } from '~bridge/auth'
import type { GatewayTarget } from '~bridge/state'

import { probeFromSavedTarget, viewAfterLiveProbe, viewForReauth } from './session-restore'

const passwordTarget: GatewayTarget = {
  authMode: 'oauth',
  baseUrl: 'http://gateway.example:9119',
  extraHeaders: { 'CF-Access-Client-Id': 'abc' },
  name: 'home',
  provider: 'basic',
  token: null,
}

function live(partial: Partial<ProbeResult>): ProbeResult {
  return {
    authMode: 'oauth',
    baseUrl: passwordTarget.baseUrl,
    error: null,
    needsLogin: false,
    providers: [],
    reachable: true,
    version: null,
    ...partial,
  }
}

describe('restored gateway auth', () => {
  it('builds a password probe from the saved target without a network probe', () => {
    const probe = probeFromSavedTarget(passwordTarget)
    expect(probe.authMode).toBe('oauth')
    expect(probe.baseUrl).toBe(passwordTarget.baseUrl)
    expect(viewForReauth(probe)).toBe('login')
    expect(probe.providers).toEqual([{ displayName: 'basic', name: 'basic', supportsPassword: true }])
  })

  it('sends a saved token gateway back to the token screen', () => {
    const probe = probeFromSavedTarget({ ...passwordTarget, authMode: 'token', provider: null, token: 'secret' })
    expect(viewForReauth(probe)).toBe('token')
  })

  it('opens login when a live probe says the password session is gone', () => {
    expect(viewAfterLiveProbe(passwordTarget, live({ needsLogin: true }))).toBe('login')
  })

  it('stays connected when the saved session is still present', () => {
    expect(viewAfterLiveProbe(passwordTarget, live({ needsLogin: false }))).toBe('connected')
  })

  it('stays connected when the gateway cannot be probed yet', () => {
    expect(viewAfterLiveProbe(passwordTarget, live({ error: 'down', reachable: false }))).toBe('connected')
  })

  it('asks for a token when a token-mode gateway was saved without one', () => {
    const saved = { ...passwordTarget, authMode: 'token' as const, provider: null, token: '  ' }
    expect(viewAfterLiveProbe(saved, live({ authMode: 'token' }))).toBe('token')
  })
})
