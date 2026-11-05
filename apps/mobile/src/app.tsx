import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'

// The REAL desktop app (DesktopController) — its AppShell already collapses to a
// drawer on narrow viewports, so mounting it on a phone gives the desktop chat
// experience, responsively. We only gate it behind connect/login.
import DesktopController from '@/app'
import { $desktopBoot } from '@/store/boot'

import { probeGateway, type ProbeResult } from '~bridge/auth'
import { $reauthNonce, currentTarget, loadTarget, setTarget, type GatewayTarget } from '~bridge/state'

import { BOOT_RETRY_STORAGE_KEY, decideBootRetry } from '~mobile/boot-retry'
import { ConnectScreen } from '~mobile/connect/ConnectScreen'
import { LoginScreen } from '~mobile/connect/LoginScreen'
import { TokenScreen } from '~mobile/connect/TokenScreen'
import { MobileBehaviors } from '~mobile/mobile-behaviors'
import { initNativeChrome } from '~mobile/native-init'
import { probeFromSavedTarget, viewAfterLiveProbe, viewForReauth } from '~mobile/session-restore'

type View = 'loading' | 'connect' | 'login' | 'token' | 'connected'

export function MobileRoot() {
  const [view, setView] = useState<View>('loading')
  const [probe, setProbe] = useState<ProbeResult | null>(null)
  const reauthNonce = useStore($reauthNonce)

  // Boot: configure native chrome (status bar), then restore a saved gateway
  // target, else show the connect screen. The saved target is enough to route
  // a later 401 — do not wait on a live probe, which fails while the radio wakes.
  useEffect(() => {
    void initNativeChrome()
    let cancelled = false
    void (async () => {
      const saved = await loadTarget()
      if (cancelled) return
      if (!saved) {
        setView('connect')
        return
      }
      setProbe(probeFromSavedTarget(saved))
      setView('connected')
      const live = await probeGateway(saved.baseUrl, saved.extraHeaders)
      if (cancelled || !live.reachable) return
      setProbe(live)
      const next = viewAfterLiveProbe(saved, live)
      if (next !== 'connected') setView(next)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // A 401 demanding re-login bounces us back to the right entry form for the
  // gateway's auth mode (token gateways re-collect the token, not a password).
  // Fall back to the saved target when this launch never ran the connect form.
  useEffect(() => {
    if (reauthNonce <= 0) return
    const saved = currentTarget()
    const known = probe ?? (saved ? probeFromSavedTarget(saved) : null)
    if (!known) return
    if (!probe) setProbe(known)
    setView(viewForReauth(known))
  }, [reauthNonce, probe])

  async function onConnected(target: GatewayTarget, p: ProbeResult) {
    setProbe(p)
    await commit(target)
  }

  async function commit(t: GatewayTarget) {
    await setTarget(t)
    setView('connected')
  }

  if (view === 'loading') {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (view === 'connect') {
    return <ConnectScreen initialUrl={probe?.baseUrl ?? ''} onConnected={onConnected} />
  }

  if (view === 'login' && probe) {
    return (
      <LoginScreen
        probe={probe}
        onBack={() => setView('connect')}
        onLoggedIn={(provider) =>
          commit({
            name: currentTarget()?.name,
            baseUrl: probe.baseUrl,
            authMode: 'oauth',
            provider,
            token: null,
            extraHeaders: currentTarget()?.extraHeaders,
          })
        }
      />
    )
  }

  if (view === 'token' && probe) {
    return (
      <TokenScreen
        probe={probe}
        onBack={() => setView('connect')}
        onToken={(token) =>
          commit({
            name: currentTarget()?.name,
            baseUrl: probe.baseUrl,
            authMode: 'token',
            provider: null,
            token,
            extraHeaders: currentTarget()?.extraHeaders,
          })
        }
      />
    )
  }

  // Connected → hand off to the real desktop chat app, plus the mobile touch
  // adaptations (sidebar drawers, settings master-detail, Android back).
  return (
    <>
      <DesktopController />
      <MobileBehaviors />
      <BootAutoRetry />
    </>
  )
}

/**
 * Cold-launch connections sometimes time out because the Wi-Fi radio is still
 * waking from power-save (the foreground lock hasn't ramped it yet) — a reload a
 * second later, with the radio warm, connects fine. Rather than greet the user
 * with the failure screen, quietly reload-retry up to twice behind a
 * "Reconnecting…" cover; only after that does the manual BootFailureOverlay take
 * over. The counter lives in sessionStorage so it survives the reload. It is
 * cleared when desktop boot reaches `renderer.ready`, not while a reload is
 * still in the starting state (`running` with no error).
 */
function BootAutoRetry() {
  const boot = useStore($desktopBoot)
  const [retrying, setRetrying] = useState(false)
  const scheduled = useRef(false)

  useEffect(() => {
    const stored = Number(window.sessionStorage.getItem(BOOT_RETRY_STORAGE_KEY) || '0')
    const tries = Number.isFinite(stored) ? stored : 0
    const decision = decideBootRetry(
      { error: boot.error, phase: boot.phase, running: boot.running },
      tries,
      scheduled.current,
    )

    if (decision === 'clear') {
      window.sessionStorage.removeItem(BOOT_RETRY_STORAGE_KEY)
      return
    }

    if (decision !== 'reload') return

    scheduled.current = true
    window.sessionStorage.setItem(BOOT_RETRY_STORAGE_KEY, String(tries + 1))
    setRetrying(true)
    const timer = window.setTimeout(() => {
      void window.hermesDesktop?.resetBootstrap?.()
      window.location.reload()
    }, 1100)
    return () => window.clearTimeout(timer)
  }, [boot.error, boot.phase, boot.running])

  if (!retrying) return null
  return (
    <div className="fixed inset-0 z-[1500] grid place-items-center bg-(--ui-chat-surface-background) text-sm text-muted-foreground">
      Reconnecting…
    </div>
  )
}
