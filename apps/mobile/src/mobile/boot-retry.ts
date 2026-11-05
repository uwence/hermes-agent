/**
 * Cold-launch reload budget for a gateway that is still waking up.
 *
 * The counter lives in sessionStorage so it survives `location.reload()`.
 * `$desktopBoot` starts every load at `running: true, error: null`, so a
 * "still starting" snapshot must not erase the count — that made every
 * failure look like the first one and the app reloaded forever.
 * `completeDesktopBoot()` is the only writer of `phase: 'renderer.ready'`.
 */

export const BOOT_RETRY_STORAGE_KEY = 'hermes-boot-retries'
export const BOOT_RETRY_MAX = 2

export interface BootRetrySnapshot {
  error: string | null
  phase: string
  running: boolean
}

export type BootRetryDecision = 'clear' | 'give-up' | 'reload' | 'wait'

export function decideBootRetry(
  boot: BootRetrySnapshot,
  tries: number,
  alreadyScheduled: boolean,
): BootRetryDecision {
  if (!boot.running && !boot.error && boot.phase === 'renderer.ready') {
    return 'clear'
  }

  if (boot.error && !boot.running && !alreadyScheduled) {
    return tries >= BOOT_RETRY_MAX ? 'give-up' : 'reload'
  }

  return 'wait'
}
