// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
  CapacitorHttp: { request: vi.fn() },
  registerPlugin: () => ({
    addListener: vi.fn(async () => ({ remove: vi.fn() })),
    connect: vi.fn(async () => ({})),
    send: vi.fn(async () => ({})),
    close: vi.fn(async () => ({})),
  }),
}))

vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>()
  return {
    Preferences: {
      get: vi.fn(async ({ key }: { key: string }) => ({ value: store.get(key) ?? null })),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
        store.set(key, value)
      }),
      remove: vi.fn(async ({ key }: { key: string }) => {
        store.delete(key)
      }),
    },
  }
})

describe('mobile browser-host marker', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-hermes-desktop-host')
    // @ts-expect-error reset between tests
    delete window.hermesDesktop
    vi.resetModules()
  })

  it('marks the document as the browser host when the bridge installs', async () => {
    const { installBridge } = await import('./install-bridge')
    installBridge()
    expect(document.documentElement.dataset.hermesDesktopHost).toBe('browser')
    expect(window.hermesDesktop).toBeTruthy()
  })

  it('does not surface a persistent remote-display toast on phone', async () => {
    const { installBridge } = await import('./install-bridge')
    installBridge()
    const reason = await window.hermesDesktop!.getRemoteDisplayReason!()
    expect(reason).toBeNull()
  })
})
