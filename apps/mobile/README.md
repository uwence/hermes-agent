# Hermes mobile (Android thin client)

A Capacitor shell that runs the **desktop renderer** against a Hermes **remote gateway** — the same path Desktop uses under Settings → Gateway. The phone does not run an agent, tools, or a Python runtime. Chat, sessions, and the model picker are the desktop UI. This process only supplies `window.hermesDesktop` (HTTP via Capacitor, session cookies, and a fresh WebSocket ticket per dial).

The shape comes from upstream draft [NousResearch/hermes-agent#49834](https://github.com/NousResearch/hermes-agent/pull/49834), rebased onto this fork's current `apps/desktop` and `apps/shared`. Auth matches the live gateway, not a guessed API:

| Step | Request |
|------|---------|
| Probe | `GET /api/status` (`auth_required` → cookie session, otherwise session token) |
| Providers | `GET /api/auth/providers` |
| Password | `POST /auth/password-login` → `hermes_session_*` cookies |
| Socket | `POST /api/auth/ws-ticket` then `ws(s)://…/api/ws?ticket=` (new ticket every dial) |
| Token mode | `X-Hermes-Session-Token` and `?token=` — refused when the token is empty |
| Sign-out | `POST /auth/logout` |

OAuth browser redirects are not in this build. A gateway whose providers are all OAuth-only tells you to use Desktop or a password gateway.

Cleartext HTTP (a Tailscale `http://` gateway and its `ws://` socket) is allowed on purpose:

- `capacitor.config.ts`: `server.cleartext: true`, `server.androidScheme: 'http'` (an `https://localhost` WebView would block `ws://` as mixed content)
- `AndroidManifest.xml`: `usesCleartextTraffic` plus `network_security_config.xml`
- `INTERNET` and `WAKE_LOCK` (the activity holds a WifiLock while foregrounded)

Application id: `com.winson.hermes.mobile`.

## Connect

On first launch the form asks for a connection **name**, **gateway URL** (`http://host:port` or `https://…`; a pasted `host:port` is treated as `http`), **username** and **password**, an optional **session token** (token-mode gateways only), and optional **extra request headers** (`Name: value`, one per line). Headers such as `Cookie`, `Authorization`, `Host`, and `X-Hermes-Session-Token` are ignored. The password is not stored; the session cookies are. Extra headers are stored in app preferences and sent on REST. On device the WebSocket upgrade always goes through OkHttp (`HermesSocket`) so the handshake never carries WebView's `Origin: http://localhost` (which remote gateways reject); saved extra headers ride the same upgrade when set.

Example (type this yourself; it is not baked into the app): name `nx-node-01`, URL `http://100.64.0.13:9119`, then the gateway username and password. The phone has to be on that tailnet.

## Build a debug APK

Host tools: **Node.js 26** (this repo's `engines` field; `.nvmrc` is `26`), **npm** matching `package.json` (`<11.10` or `>=11.17`), **JDK 17+** (21 is fine), and the **Android SDK** with `ANDROID_HOME` set and licenses accepted. Platform compile SDK is 36.

```bash
# from the repo root
npm ci
npm run --prefix apps/mobile test
npm run --prefix apps/mobile build
cd apps/mobile
npx cap sync android
cd android && ./gradlew assembleDebug
```

APK:

```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Install:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`npm ci` runs `patch-package`. The patch stops `@capacitor-community/safe-area` from padding for the IME on top of the WebView's own keyboard resize.

What was verified in the cloud agent, and what was not, is in the pull request description. If `gradlew assembleDebug` cannot run because the SDK is missing, install command-line tools, then:

```bash
export ANDROID_HOME="$HOME/android-sdk"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
sdkmanager --sdk_root="$ANDROID_HOME" "platform-tools" "platforms;android-36" "build-tools;36.0.0"
yes | sdkmanager --licenses
cd apps/mobile/android && ./gradlew assembleDebug
```

## Weekly upstream sync

This fork tracks [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent). Once a week:

```bash
git fetch upstream
git checkout main
git merge upstream/main
# fix apps/mobile if desktop imports moved, then:
npm ci
npm run --prefix apps/mobile test
npm run --prefix apps/mobile build
```

`.github/workflows/upstream-sync.yml` opens an `upstream-sync-YYYYMMDD` pull request from `upstream/main` on Mondays (and on manual dispatch). `.github/workflows/mobile-ci.yml` typechecks, runs the bridge tests, and builds the Vite bundle on every push and pull request. It does not assemble the APK.

`apps/mobile/DESKTOP-PATCHES.md` records that this client does not patch desktop source.

## License

Hermes Agent is MIT. This client lives in the same tree and keeps that license. It is not a Nous Research product.
