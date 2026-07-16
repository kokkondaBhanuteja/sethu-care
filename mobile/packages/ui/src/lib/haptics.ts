import * as Haptics from "expo-haptics";

// Fire-and-forget haptics for touch feedback. No-ops on devices without a Taptic Engine — the
// rejection is swallowed so callers never guard. `tap` for buttons (a light impact), `select` for
// navigation taps on cards/rows (the subtler selection tick).
export function tapFeedback() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function selectFeedback() {
  void Haptics.selectionAsync().catch(() => {});
}
