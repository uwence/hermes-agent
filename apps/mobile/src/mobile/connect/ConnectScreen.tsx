import { useState } from 'react'

import { passwordLogin, probeGateway, type ProbeResult } from '~bridge/auth'
import { parseExtraHeaderLines } from '~bridge/connection-config'
import type { GatewayTarget } from '~bridge/state'

import { Brand, Button, Card, ErrorNote, Field, Screen, TextArea } from '../ui'

/**
 * Remote-gateway form: name, URL, username/password, optional session token,
 * optional extra headers. Nothing here is hardcoded to a particular host.
 */
export function ConnectScreen({
  initialUrl = '',
  initialName = '',
  initialHeaders = '',
  onConnected,
}: {
  initialUrl?: string
  initialName?: string
  initialHeaders?: string
  onConnected: (target: GatewayTarget, probe: ProbeResult) => void | Promise<void>
}) {
  const [name, setName] = useState(initialName)
  const [url, setUrl] = useState(initialUrl)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [headersText, setHeadersText] = useState(initialHeaders)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (busy) return
    const label = name.trim()
    if (!label) {
      setError('Name the connection.')
      return
    }
    if (!url.trim()) {
      setError('Gateway URL is required.')
      return
    }
    setBusy(true)
    setError(null)
    const extraHeaders = parseExtraHeaderLines(headersText)
    try {
      const probe = await probeGateway(url, extraHeaders)
      if (!probe.reachable) {
        setError(probe.error ?? 'Could not reach that gateway.')
        return
      }

      if (probe.authMode === 'token') {
        const sessionToken = token.trim()
        if (!sessionToken) {
          setError('This gateway uses a session token. Paste one, or switch the gateway to password login.')
          return
        }
        await onConnected(
          {
            name: label,
            baseUrl: probe.baseUrl,
            authMode: 'token',
            provider: null,
            token: sessionToken,
            extraHeaders,
          },
          probe,
        )
        return
      }

      const passwordProvider = probe.providers.find((p) => p.supportsPassword)
      const oauthOnly = probe.providers.length > 0 && !passwordProvider
      if (oauthOnly) {
        const names = probe.providers.map((p) => p.displayName).join(', ')
        setError(
          `This gateway signs in with ${names || 'OAuth'}. The mobile app only supports username/password or a session token.`,
        )
        return
      }

      const provider = passwordProvider?.name ?? 'basic'
      if (probe.needsLogin) {
        if (!username.trim() || !password) {
          setError('Enter the gateway username and password.')
          return
        }
        await passwordLogin(probe.baseUrl, {
          provider,
          username: username.trim(),
          password,
          extraHeaders,
        })
      }

      await onConnected(
        {
          name: label,
          baseUrl: probe.baseUrl,
          authMode: 'oauth',
          provider,
          token: null,
          extraHeaders,
        },
        probe,
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
      setPassword('')
    }
  }

  return (
    <Screen>
      <Brand subtitle="Remote gateway" />
      <Card>
        <Field
          label="Name"
          placeholder="Home gateway"
          autoCapitalize="words"
          autoCorrect="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          label="Gateway URL"
          placeholder="http://host:9119"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Field
          label="Username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Field
          label="Session token"
          type="password"
          placeholder="Only for token-mode gateways"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <TextArea
          label="Extra request headers"
          placeholder={'CF-Access-Client-Id: …\nCF-Access-Client-Secret: …'}
          value={headersText}
          onChange={(e) => setHeadersText(e.target.value)}
        />
        <ErrorNote>{error}</ErrorNote>
        <Button busy={busy} onClick={() => void submit()}>
          Save connection
        </Button>
      </Card>
      <p className="px-1 text-center text-xs text-muted-foreground/80">
        The agent stays on the computer or server that runs Hermes. This phone is a screen for that
        remote gateway — the same URL, username, and password Desktop uses. HTTP on a tailnet works.
        Cookie, Authorization, and Host cannot be overridden.
      </p>
    </Screen>
  )
}
