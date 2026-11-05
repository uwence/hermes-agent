/**
 * connection.ts — the connection-descriptor half of the bridge.
 *
 * Implements `getConnection` / `getGatewayWsUrl` from the window.hermesDesktop
 * contract. The vendored desktop `store/gateway.ts` + `lib/gateway-ws-url.ts`
 * call these before every connect; `getGatewayWsUrl` mints a FRESH single-use
 * ws-ticket each time (30s TTL, single-use), exactly as the desktop main
 * process does.
 */

import type { HermesConnection } from '@/global'

import { mintWsTicket } from './auth'
import { buildGatewayWsUrl, buildGatewayWsUrlWithTicket, withWsProfile } from './connection-config'
import { currentTarget, requireReauth } from './state'

function requireTarget() {
  const target = currentTarget()
  if (!target) throw new Error('Not connected to a gateway.')
  return target
}

/** Build the WS URL the gateway client connects with. OAuth/password gateways
 *  mint a fresh ticket; token gateways embed the long-lived token. An empty
 *  token is refused — desktop `buildRemoteConnection` does the same. */
export async function getGatewayWsUrl(profile?: null | string): Promise<string> {
  const target = requireTarget()
  if (target.authMode === 'oauth') {
    try {
      const ticket = await mintWsTicket(target.baseUrl)
      return withWsProfile(buildGatewayWsUrlWithTicket(target.baseUrl, ticket), profile)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/\b401\b|\b403\b/.test(message)) {
        requireReauth()
        const rejected = new Error('Your remote gateway session has expired. Sign in again.')
        ;(rejected as Error & { needsOauthLogin?: boolean }).needsOauthLogin = true
        throw rejected
      }
      throw error
    }
  }
  const token = target.token?.trim() ?? ''
  if (!token) {
    throw new Error(
      'Remote Hermes gateway is selected, but no session token is saved. Enter a session token, or use password login.',
    )
  }
  return withWsProfile(buildGatewayWsUrl(target.baseUrl, token), profile)
}

/** Resolve a full connection descriptor. `wsUrl` is minted fresh so a cached
 *  descriptor is always connectable; the vendored re-mint path also re-calls
 *  getGatewayWsUrl on each connect. */
export async function getConnection(profile?: null | string): Promise<HermesConnection> {
  const target = requireTarget()
  const wsUrl = await getGatewayWsUrl(profile)
  let remoteHost = ''
  try {
    remoteHost = new URL(target.baseUrl).host
  } catch {
    remoteHost = target.baseUrl
  }
  const scoped = profile?.trim() || undefined
  return {
    baseUrl: target.baseUrl,
    isFullscreen: false,
    mode: 'remote',
    authMode: target.authMode,
    remoteHost,
    remoteKind: 'url',
    nativeOverlayWidth: 0,
    source: 'settings',
    profile: scoped,
    // token gateways carry the static token; oauth authenticates via cookies.
    token: target.authMode === 'token' ? (target.token ?? '') : '',
    wsUrl,
    logs: [],
    windowButtonPosition: null,
  }
}
