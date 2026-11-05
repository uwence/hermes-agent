import type { ProbeResult } from '~bridge/auth'
import type { GatewayTarget } from '~bridge/state'

/**
 * Auth context for a gateway restored from preferences.
 *
 * Cold launch used to mount the desktop with `probe === null`. A later 401
 * bumps `$reauthNonce`, but the screen switch required a probe from the
 * first-run form, so the user stayed on the failure overlay. The saved
 * target already knows token vs password; a live probe only refreshes it.
 */
export function probeFromSavedTarget(target: GatewayTarget): ProbeResult {
  const provider = target.provider?.trim() || null

  return {
    authMode: target.authMode,
    baseUrl: target.baseUrl,
    error: null,
    needsLogin: target.authMode === 'oauth',
    providers:
      target.authMode === 'oauth' && provider
        ? [{ displayName: provider, name: provider, supportsPassword: true }]
        : [],
    reachable: true,
    version: null,
  }
}

/** Where a 401 sends the user. Token gateways collect a token, not a password. */
export function viewForReauth(probe: ProbeResult): 'login' | 'token' {
  return probe.authMode === 'token' ? 'token' : 'login'
}

/**
 * After a live probe of a restored target. Stay on the desktop when the saved
 * session can still be tried. Leave it when the probe already knows sign-in
 * is required, so we do not wait for the boot overlay.
 */
export function viewAfterLiveProbe(saved: GatewayTarget, live: ProbeResult): 'connected' | 'login' | 'token' {
  if (!live.reachable) return 'connected'
  if (live.authMode === 'token' && !saved.token?.trim()) return 'token'
  if (live.authMode === 'oauth' && live.needsLogin) return 'login'
  return 'connected'
}
