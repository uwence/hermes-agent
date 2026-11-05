import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Plugin } from 'vite'

const here = path.dirname(fileURLToPath(import.meta.url))

/** Absolute path of the desktop hook we intercept. */
export const DESKTOP_COMPOSER_METRICS = path.resolve(
  here,
  '../../../desktop/src/app/chat/composer/hooks/use-composer-metrics.ts',
)

/** Absolute path of the mobile wrapper that re-exports + adapts it. */
export const MOBILE_COMPOSER_METRICS = path.resolve(here, 'use-composer-metrics.ts')

/**
 * Redirect every resolve of the desktop `use-composer-metrics` module to the
 * mobile wrapper — including relative imports from `composer/index.tsx`, which
 * a plain `@/…` alias would miss.
 *
 * The wrapper itself imports the desktop file by relative path; we leave that
 * resolve alone so the real hook still loads.
 */
export function mobileComposerMetricsAlias(): Plugin {
  const desktop = path.normalize(DESKTOP_COMPOSER_METRICS)
  const mobile = path.normalize(MOBILE_COMPOSER_METRICS)

  return {
    name: 'hermes-mobile-composer-metrics-alias',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer) return null
      if (path.normalize(importer.split('?')[0]!) === mobile) return null

      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (!resolved) return null

      const id = path.normalize(resolved.id.split('?')[0]!)
      if (id !== desktop) return null
      return mobile
    },
  }
}
