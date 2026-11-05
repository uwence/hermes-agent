/**
 * install-bridge.ts
 *
 * Assembles the browser implementation of `window.hermesDesktop` and installs it
 * on `window` BEFORE React mounts, so the desktop renderer (which calls
 * `window.hermesDesktop.*`) runs unmodified. Networking is CapacitorHttp +
 * a cookie jar + a fresh `/api/auth/ws-ticket` per dial — the same remote
 * gateway contract Electron uses.
 */

import { createMobileDesktopBridge } from './surface'
import { installWebSocketHeaders } from './ws-headers'

let installed = false

export function installBridge(): void {
  if (installed) return
  installed = true
  // Opt into Desktop's browser-host touch layout (44px controls, narrow-overlay
  // chrome, keep-focus-on-press, etc.). Same marker the webapp bridge writes.
  document.documentElement.dataset.hermesDesktopHost = 'browser'
  window.hermesDesktop = createMobileDesktopBridge()
  installWebSocketHeaders()
}
