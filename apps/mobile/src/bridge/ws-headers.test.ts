/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { connect, addListener } = vi.hoisted(() => ({
  connect: vi.fn(async (_opts: { id: string; url: string; headers: Record<string, string> }) => undefined),
  addListener: vi.fn(async () => ({ remove: vi.fn() })),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({
    connect,
    send: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    addListener,
  }),
}))

vi.mock('./state', () => ({
  currentTarget: () => ({ baseUrl: 'http://gw:9119', authMode: 'oauth', provider: 'local', token: null }),
}))

import { installWebSocketHeaders } from './ws-headers'

describe('installWebSocketHeaders', () => {
  beforeEach(() => {
    connect.mockClear()
    // Fresh WebSocket each test so the patch can re-apply.
    const Original = class {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3
      constructor(_url: string, _protocols?: string | string[]) {}
    }
    window.WebSocket = Original as unknown as typeof WebSocket
  })

  it('uses OkHttp even when no extra headers are set', () => {
    installWebSocketHeaders()
    const socket = new WebSocket('ws://gw:9119/api/ws?ticket=t')
    expect(connect).toHaveBeenCalledTimes(1)
    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'ws://gw:9119/api/ws?ticket=t',
        headers: {},
      }),
    )
    expect(socket).toBeTruthy()
  })
})
