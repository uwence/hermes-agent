# Desktop patches

None. `apps/mobile` does not modify `apps/desktop` or `apps/shared`.

The phone imports the desktop renderer through Vite aliases (`@` → `apps/desktop/src`, `@hermes/shared` → `apps/shared/src`) and installs `window.hermesDesktop` before that renderer evaluates. Touch behavior (back button, drawer reveal, safe area) lives under `apps/mobile/src/mobile`.

A desktop refactor that changes the bridge or a module the mobile entry imports will fail `npm run --prefix apps/mobile typecheck` and `build` in `.github/workflows/mobile-ci.yml`.
