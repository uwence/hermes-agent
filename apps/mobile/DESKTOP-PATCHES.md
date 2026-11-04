# Desktop patches

None as source edits. `apps/mobile` does not modify files under `apps/desktop` or `apps/shared`.

The phone imports the desktop renderer through Vite aliases (`@` → `apps/desktop/src`, `@hermes/shared` → `apps/shared/src`) and installs `window.hermesDesktop` before that renderer evaluates. Touch behavior (back button, drawer reveal, safe area, phone chrome) lives under `apps/mobile/src/mobile`.

## How the phone UI lights up Desktop's touch layout

1. **Browser host marker** — `install-bridge.ts` sets `document.documentElement.dataset.hermesDesktopHost = 'browser'`, the same marker the webapp bridge writes. That flips `hostHas('touchSizedControls')` (and narrow-overlay chrome, keep-focus-on-press, …) so Desktop's coarse-pointer CSS promotes composer controls to **44px** and `useTouchTitlebar` grows the titleband to **44px**.
2. **Composer model label** — Desktop sheds the model-pill label below 560px (`compactPill`). Phones live there. A Vite plugin remaps `use-composer-metrics` to a mobile wrapper that keeps the label and stacks the composer (see table below).
3. **Simple interface mode** — `MobileBehaviors` forces Simple so flip-panes / HUD / right-sidebar (advanced tier) leave the titlebar. Layout editor is CSS-hidden (`.group\/tool`).
4. **Remote-client banner** — `getRemoteDisplayReason` returns `null` on phone so the persistent top-center toast does not cover titlebar/tabs. The connect screen already names the remote-client role.
5. **theme-fallback.css** — safe areas, 44px titlebar/statusbar targets, transcript readability, drawer-open titlebar hide (unchanged).

| Intercept | Replacement | Why |
| --- | --- | --- |
| `apps/desktop/.../hooks/use-composer-metrics.ts` (any import path) | `src/mobile/use-composer-metrics.ts` | Desktop sheds the model-pill label below 560px; phones live there, so the adapter keeps the label and stacks the composer instead. See `src/mobile/composer-fit.ts`. |

A desktop refactor that changes the bridge or a module the mobile entry imports will fail `npm run --prefix apps/mobile typecheck` and `build` in `.github/workflows/mobile-ci.yml`.
