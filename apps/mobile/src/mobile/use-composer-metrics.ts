/**
 * Vite-aliased stand-in for `@/app/chat/composer/hooks/use-composer-metrics`.
 * Runs the desktop hook, then adapts the fit for a phone-sized composer.
 */
import { useComposerMetrics as useDesktopComposerMetrics } from '../../../desktop/src/app/chat/composer/hooks/use-composer-metrics'

import { adaptComposerFitForMobile } from './composer-fit'

export function useComposerMetrics(
  ...args: Parameters<typeof useDesktopComposerMetrics>
): ReturnType<typeof useDesktopComposerMetrics> {
  return adaptComposerFitForMobile(useDesktopComposerMetrics(...args))
}

export type { ComposerFit } from '../../../desktop/src/app/chat/composer/hooks/use-composer-metrics'
