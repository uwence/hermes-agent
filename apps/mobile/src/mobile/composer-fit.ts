/**
 * Mobile composer fit — keep the selected model name visible on a phone.
 *
 * Desktop's progressive collapse sheds the model-pill label below 560px
 * (`compactPill`) so a narrow *inline* row can keep typing room. On a phone
 * that width is the normal case, so the pill collapses to a chevron and the
 * current model disappears. When desktop would hide the label, stack the
 * composer (input on its own row, controls below) and keep the full pill —
 * the controls row then has the whole width for the name + voice + send.
 */
export type ComposerFitLike = {
  compactPill: boolean
  foldVoice: boolean
  minimal: boolean
  stacked: boolean
  tight: boolean
  singleColumn: boolean
}

export function adaptComposerFitForMobile<T extends ComposerFitLike>(fit: T): T {
  // Desktop already folded voice / went minimal — leave those alone.
  // Only rewrite the "label → chevron" stage that phones hit by default.
  if (!fit.compactPill && !fit.tight) {
    return fit
  }

  return {
    ...fit,
    compactPill: false,
    // Stack so the labelled pill sits on a full-width controls row instead of
    // competing with the input for the same ~390px.
    stacked: true,
    // Fold the three voice toggles into the menu once we insist on a label,
    // matching the space budget desktop already uses at the fold-voice rung.
    foldVoice: true,
  }
}
