import { describe, expect, it } from 'vitest'

import { BOOT_RETRY_MAX, decideBootRetry } from './boot-retry'

const starting = { running: true, error: null, phase: 'renderer.init' }
const failed = { running: false, error: 'gateway unreachable', phase: 'renderer.error' }
const ready = { running: false, error: null, phase: 'renderer.ready' }

describe('decideBootRetry', () => {
  it('does not clear the counter while boot is merely starting', () => {
    expect(decideBootRetry(starting, 1, false)).toBe('wait')
  })

  it('does not treat a pre-connect ready snapshot as success', () => {
    // getBootProgress answers running:false before the socket is open.
    // That is not completeDesktopBoot (phase renderer.ready).
    expect(decideBootRetry({ running: false, error: null, phase: 'runtime.ready' }, 1, false)).toBe('wait')
  })

  it('reloads a failed boot until the budget is spent', () => {
    expect(decideBootRetry(failed, 0, false)).toBe('reload')
    expect(decideBootRetry(failed, BOOT_RETRY_MAX - 1, false)).toBe('reload')
    expect(decideBootRetry(failed, BOOT_RETRY_MAX, false)).toBe('give-up')
  })

  it('does not schedule a second reload for the same failure', () => {
    expect(decideBootRetry(failed, 0, true)).toBe('wait')
  })

  it('clears the counter only after boot completes', () => {
    expect(decideBootRetry(ready, BOOT_RETRY_MAX, false)).toBe('clear')
  })
})
