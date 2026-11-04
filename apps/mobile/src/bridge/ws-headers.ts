/**
 * WebSocket handshake headers.
 *
 * The renderer dials `new WebSocket(url)`. A browser socket cannot set
 * Cloudflare Access (or any other) headers. When the saved connection has
 * extra headers and we are inside the Capacitor shell, this replaces
 * `window.WebSocket` with a shim that opens the socket through OkHttp
 * (`HermesSocket` plugin) so those headers ride the upgrade. With no extra
 * headers the real WebView socket is used, which is what cleartext `ws://`
 * on Tailscale needs.
 */

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { Capacitor } from '@capacitor/core'

import { filterExtraHeaders } from './connection-config'
import { currentTarget } from './state'

interface FramePayload {
  id: string
  event: 'open' | 'message' | 'close' | 'error'
  data?: string
  code?: number
  reason?: string
}

interface HermesSocketPlugin {
  connect(options: { id: string; url: string; headers: Record<string, string> }): Promise<void>
  send(options: { id: string; data: string }): Promise<void>
  close(options: { id: string; code: number; reason: string }): Promise<void>
  addListener(eventName: 'frame', listener: (payload: FramePayload) => void): Promise<PluginListenerHandle>
}

const HermesSocket = registerPlugin<HermesSocketPlugin>('HermesSocket')

const sockets = new Map<string, NativeHeaderSocket>()
let listening = false

function ensureListener(): void {
  if (listening) return
  listening = true
  void HermesSocket.addListener('frame', (payload) => {
    sockets.get(payload.id)?.dispatch(payload)
  })
}

class NativeHeaderSocket extends EventTarget {
  readonly url: string
  readyState = 0
  binaryType: BinaryType = 'blob'
  bufferedAmount = 0
  extensions = ''
  protocol = ''
  private readonly id: string

  constructor(url: string, headers: Record<string, string>) {
    super()
    this.url = url
    this.id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    sockets.set(this.id, this)
    ensureListener()
    void HermesSocket.connect({ id: this.id, url, headers }).catch((error: unknown) => {
      this.readyState = 3
      this.dispatchEvent(new Event('error'))
      this.dispatchEvent(new CloseEvent('close', { code: 1006, reason: error instanceof Error ? error.message : 'connect failed' }))
      sockets.delete(this.id)
    })
  }

  dispatch(payload: FramePayload): void {
    if (payload.event === 'open') {
      this.readyState = 1
      this.dispatchEvent(new Event('open'))
      return
    }
    if (payload.event === 'message') {
      this.dispatchEvent(new MessageEvent('message', { data: payload.data ?? '' }))
      return
    }
    if (payload.event === 'error') {
      this.dispatchEvent(new Event('error'))
      return
    }
    this.readyState = 3
    sockets.delete(this.id)
    this.dispatchEvent(new CloseEvent('close', { code: payload.code ?? 1000, reason: payload.reason ?? '' }))
  }

  send(data: string): void {
    if (this.readyState !== 1) return
    void HermesSocket.send({ id: this.id, data: String(data) })
  }

  close(code = 1000, reason = ''): void {
    if (this.readyState === 3) return
    this.readyState = 2
    void HermesSocket.close({ id: this.id, code, reason })
  }
}

export function installWebSocketHeaders(): void {
  const Original = window.WebSocket
  if ((Original as unknown as { __hermesPatched?: boolean }).__hermesPatched) return

  function HermesWebSocket(this: unknown, url: string | URL, protocols?: string | string[]): WebSocket {
    const headers = filterExtraHeaders(currentTarget()?.extraHeaders)
    const target = String(url)
    if (!Capacitor.isNativePlatform() || Object.keys(headers).length === 0) {
      return new Original(target, protocols)
    }
    return new NativeHeaderSocket(target, headers) as unknown as WebSocket
  }

  HermesWebSocket.CONNECTING = Original.CONNECTING
  HermesWebSocket.OPEN = Original.OPEN
  HermesWebSocket.CLOSING = Original.CLOSING
  HermesWebSocket.CLOSED = Original.CLOSED
  HermesWebSocket.prototype = Original.prototype
  ;(HermesWebSocket as unknown as { __hermesPatched?: boolean }).__hermesPatched = true
  window.WebSocket = HermesWebSocket as unknown as typeof WebSocket
}
