import { describe, expect, it } from 'vitest'

import { adaptComposerFitForMobile } from './composer-fit'

const roomy = {
  compactPill: false,
  foldVoice: false,
  minimal: false,
  stacked: false,
  tight: false,
  singleColumn: false,
}

describe('adaptComposerFitForMobile', () => {
  it('leaves a roomy desktop fit alone', () => {
    expect(adaptComposerFitForMobile(roomy)).toEqual(roomy)
  })

  it('keeps the model label and stacks when desktop would compact the pill', () => {
    expect(
      adaptComposerFitForMobile({
        ...roomy,
        compactPill: true,
      }),
    ).toEqual({
      ...roomy,
      compactPill: false,
      stacked: true,
      foldVoice: true,
    })
  })

  it('stacks for a tight pane that would already compact the pill', () => {
    expect(
      adaptComposerFitForMobile({
        ...roomy,
        compactPill: true,
        tight: true,
        foldVoice: true,
      }),
    ).toEqual({
      ...roomy,
      compactPill: false,
      tight: true,
      stacked: true,
      foldVoice: true,
    })
  })

  it('preserves minimal (send-only) so ultra-narrow panes still fit', () => {
    expect(
      adaptComposerFitForMobile({
        ...roomy,
        compactPill: true,
        foldVoice: true,
        minimal: true,
        stacked: true,
        tight: true,
      }),
    ).toMatchObject({ compactPill: false, minimal: true, stacked: true })
  })
})
