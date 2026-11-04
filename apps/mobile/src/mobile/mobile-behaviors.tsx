import { App } from '@capacitor/app'
import { Keyboard } from '@capacitor/keyboard'
import { useEffect } from 'react'
import { useLocation } from 'react-router'

import { PANE_TOGGLE_REVEAL_EVENT } from '@/components/pane-shell'
import { $narrowOverlayPaneIds } from '@/components/pane-shell/narrow-overlay-state'
import {
  CHAT_SIDEBAR_PANE_ID,
  FILE_BROWSER_PANE_ID,
  $panesFlipped,
} from '@/store/layout'

/**
 * MobileBehaviors — the touch adaptations layered over the reused desktop UI.
 *
 *  1. Narrow drawers: on a phone the sessions/files rails leave the grid and
 *     live as overlays (`NarrowOverlays`). Open/close is the reveal event, NOT
 *     `$sidebarOpen` (that pane flag stays true by default and
 *     `toggleSidebarOpen` on narrow only flips the overlay — so treating
 *     `$sidebarOpen` as "drawer open" made every tap toggle the sidebar).
 *  2. Tap-outside dismisses with mode `close` (never toggle), and ignores taps
 *     that land inside `[data-narrow-overlay]` so session rows can activate.
 *  3. One Android back handler: keyboard → dismiss, else drawer → closed, else
 *     default (history back / exit).
 *
 * Overlay screens (Settings/Skills/Profiles) get their responsive master-detail
 * from upstream now (overlays/overlay-split-layout.tsx), so nothing here.
 */
const OVERLAY_INSIDE =
  '[data-narrow-overlay], [data-narrow-overlay-tab], [data-pane-overlay], [data-titlebar-cluster]'

function closeOverlay(id: string) {
  window.dispatchEvent(new CustomEvent(PANE_TOGGLE_REVEAL_EVENT, { detail: { id, mode: 'close' } }))
}

function anyOverlayOpen() {
  return $narrowOverlayPaneIds.get().size > 0
}

function closeOpenOverlay() {
  if (!anyOverlayOpen()) return
  // Sessions + files (and their reveal aliases). Closing a non-matching id is a
  // no-op in NarrowOverlays; issuing both covers whichever edge is showing.
  closeOverlay(CHAT_SIDEBAR_PANE_ID)
  closeOverlay(FILE_BROWSER_PANE_ID)
}

export function MobileBehaviors() {
  const location = useLocation()

  // Navigating (selecting a session) dismisses an open chat drawer — close, do
  // not toggle (toggle would re-open when the docked `$sidebarOpen` flag was
  // used as the open signal).
  useEffect(() => {
    closeOpenOverlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  useEffect(() => {
    // Standard orientation: sessions LEFT, files RIGHT.
    $panesFlipped.set(false)

    // Track keyboard visibility so the Android back button can dismiss it first
    // (see the backButton handler). The WebView resizes above the keyboard on its
    // own — Chromium handles that natively on Android edge-to-edge, and the
    // SafeArea plugin is patched (patches/) so it doesn't double-count the IME
    // inset (which collapsed the viewport to ~241px).
    let keyboardOpen = false
    const kbShow = Keyboard.addListener('keyboardWillShow', () => {
      keyboardOpen = true
    })
    const kbHide = Keyboard.addListener('keyboardWillHide', () => {
      keyboardOpen = false
    })

    const syncDrawerAttr = () => {
      document.documentElement.toggleAttribute('data-drawer-open', anyOverlayOpen())
    }
    // Narrow overlay open state is the source of truth on a phone — not the
    // docked `$sidebarOpen` pane flag (defaults true and is not flipped by the
    // narrow toggle path).
    const offOverlayAttr = $narrowOverlayPaneIds.subscribe(syncDrawerAttr)
    syncDrawerAttr()

    // Ignore dismiss for a beat after a reveal so the same gesture that opened
    // the drawer (titlebar burger → click) cannot immediately close it if a
    // synthetic click lands outside the overlay chrome.
    let openedAt = 0
    const onReveal = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: string }>).detail?.mode
      if (mode === 'close') return
      openedAt = Date.now()
    }
    window.addEventListener(PANE_TOGGLE_REVEAL_EVENT, onReveal)

    const onPointerDown = (e: PointerEvent) => {
      if (!anyOverlayOpen()) return
      const target = e.target as Element | null
      // Tap inside the drawer (or its tab strip / titlebar cluster) → leave it
      // alone so the row/button can activate.
      if (target?.closest(OVERLAY_INSIDE)) return
      // Same gesture that just opened → ignore.
      if (Date.now() - openedAt < 350) return
      closeOpenOverlay()
    }
    document.addEventListener('pointerdown', onPointerDown, true)

    let backHandle: { remove: () => void } | undefined
    void App.addListener('backButton', ({ canGoBack }) => {
      // Keyboard open → just dismiss it (and blur, so it doesn't auto-reopen
      // from the composer regaining focus). Don't navigate.
      if (keyboardOpen) {
        ;(document.activeElement as HTMLElement | null)?.blur()
        void Keyboard.hide()
        return
      }
      if (anyOverlayOpen()) {
        closeOpenOverlay()
        return
      }
      if (canGoBack) window.history.back()
      else void App.exitApp()
    }).then((h) => {
      backHandle = h
    })

    return () => {
      offOverlayAttr()
      window.removeEventListener(PANE_TOGGLE_REVEAL_EVENT, onReveal)
      document.removeEventListener('pointerdown', onPointerDown, true)
      backHandle?.remove()
      void kbShow.then((h) => h.remove())
      void kbHide.then((h) => h.remove())
      document.documentElement.removeAttribute('data-drawer-open')
    }
  }, [])

  // No UI — this component exists only for the side effects wired up above.
  return null
}
