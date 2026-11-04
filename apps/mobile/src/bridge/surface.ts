/**
 * Fill the current `window.hermesDesktop` contract for a phone that has no
 * local agent. Networking is real (see connection.ts / http.ts). Everything
 * that needs the desktop machine — terminal PTYs, OS file dialogs, auto-update,
 * OAuth browser redirects — answers with a defined refusal instead of throwing
 * `undefined is not a function` when the reused renderer touches it.
 */

import type { HermesApiRequest } from '@/global'
import { BROWSER_BRIDGE_STUBS } from '@/lib/browser-bridge-stubs'

import { getConnection, getGatewayWsUrl } from './connection'
import { api } from './http'
import { notify, onPowerResume, openExternal, readClipboard, writeClipboard } from './native'
import { currentTarget } from './state'

const unsupported = { ok: false as const, error: 'unsupported-on-mobile' }

function connectionConfig() {
  const target = currentTarget()
  const oauth = target?.authMode === 'oauth'
  return {
    cloudOrg: '',
    envOverride: false,
    mode: 'remote' as const,
    profile: null,
    remoteAuthMode: oauth ? ('oauth' as const) : ('token' as const),
    remoteOauthConnected: oauth,
    remoteTokenPlainText: false,
    remoteTokenPreview: null,
    remoteTokenSet: Boolean(target?.token),
    secureTokenStorage: false,
    remoteUrl: target?.baseUrl ?? '',
    sshHost: '',
    sshKeyPath: '',
    sshPort: null,
    sshRemoteHermesPath: '',
    sshRemoteProfile: '',
    sshUser: '',
  }
}

let rememberedProfile: string | null = null

export function createMobileDesktopBridge(): Window['hermesDesktop'] {
  return {
    ...BROWSER_BRIDGE_STUBS,
    getBootProgress: async () => ({
      error: null,
      fakeMode: false,
      message: 'Connected',
      phase: 'runtime.ready',
      progress: 100,
      running: false,
      timestamp: Date.now(),
    }),
    getRemoteDisplayReason: async () => 'This phone is a remote client of your Hermes gateway',
    api: <T>(request: HermesApiRequest) => api<T>(request),
    getConnection: (profile?: null | string) => getConnection(profile),
    getConnectionFor: async (payload: { connectionId?: null | string; profile?: null | string }) =>
      getConnection(payload.profile),
    getGatewayWsUrl: async (profile?: null | string) => ({ ok: true as const, wsUrl: await getGatewayWsUrl(profile) }),
    getGatewayWsUrlFor: async (payload: { connectionId?: null | string; profile?: null | string }) => ({
      ok: true as const,
      wsUrl: await getGatewayWsUrl(payload.profile),
    }),
    getProfileRoutes: async () => [],
    revalidateConnection: async () => ({ ok: true, rebuilt: false }),
    openSessionWindow: async () => unsupported,
    openWindow: async () => unsupported,
    getConnectionConfig: async () => connectionConfig(),
    saveConnectionConfig: async () => connectionConfig(),
    applyConnectionConfig: async () => connectionConfig(),
    testConnectionConfig: async () => ({
      baseUrl: currentTarget()?.baseUrl,
      ok: true,
      reachable: true,
      version: null,
      error: null,
    }),
    oauthLoginConnectionConfig: async (remoteUrl: string) => ({
      ok: false,
      baseUrl: remoteUrl,
      connected: false,
      error: 'OAuth redirect sign-in is not available in the mobile client. Use a password gateway.',
    }),
    oauthLogoutConnectionConfig: async () => ({ ok: true, connected: false }),
    profile: {
      getDefault: async () => null,
      setDefault: async (route) => route,
      onDefaultChanged: () => () => undefined,
      get: async () => ({ profile: rememberedProfile }),
      remember: async (name) => {
        rememberedProfile = name
        return { profile: rememberedProfile }
      },
      set: async (name) => {
        rememberedProfile = name
        return { profile: rememberedProfile }
      },
    },
    notify,
    requestMicrophoneAccess: async () => {
      if (!navigator.mediaDevices?.getUserMedia) return false
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      return true
    },
    readFileDataUrl: async (filePath: string) => ({
      ok: false as const,
      error: 'unsupported-on-mobile',
      message: 'This phone does not read host files directly.',
      path: filePath,
    }),
    readFileText: async (filePath: string) => ({
      ok: false as const,
      error: 'unsupported-on-mobile',
      message: 'This phone does not read host files directly.',
      path: filePath,
    }),
    selectPaths: async () => [],
    writeClipboard,
    readClipboard,
    saveImageFromUrl: async () => false,
    saveImageBuffer: async () => '',
    savePastedText: async () => '',
    saveClipboardImage: async () => '',
    openExternal,
    onPowerResume,
    settings: {
      getDefaultProjectDir: async () => ({ defaultLabel: 'Gateway', dir: null, resolvedCwd: '' }),
      pickDefaultProjectDir: async () => ({ canceled: true, dir: null }),
      setDefaultProjectDir: async (dir) => ({ dir }),
    },
    readDir: async () => ({ entries: [], error: 'Host folders are not available on the phone.' }),
    terminal: {
      attach: async () => false,
      cwd: async () => null,
      dispose: async () => false,
      onData: () => () => undefined,
      onExit: () => () => undefined,
      resize: async () => false,
      start: async () => ({ cwd: '', id: 'mobile-no-shell', shell: '', unavailable: 'no-shell' as const }),
      write: async () => false,
    },
    getOnBattery: async () => false,
    getVersion: async () => ({
      appVersion: 'mobile',
      electronVersion: '',
      hermesRoot: '',
      nodeVersion: '',
      platform: 'android',
    }),
    findInPage: async (query: string) => {
      const find = (window as Window & { find?: (value: string) => boolean }).find
      return { count: query && find?.call(window, query) ? 1 : 0 }
    },
  }
}
