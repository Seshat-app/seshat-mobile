// Motion tokens - mirrors seshat-web/src/styles/tokens.scss (--ease-*, --d-*)
// so mobile and web move at the same cadence. Before this, every sheet/
// modal on mobile hardcoded its own duration (200-340ms) and easing
// independently, so near-identical "slide up and settle" moments each felt
// slightly different. Use these instead of a raw number.
//
// Durations are plain ms - pass straight to Animated.timing's `duration`.
// Easings are cubic-bezier control points - pass to Easing.bezier(...EASE.x)
// from either 'react-native' or 'react-native-reanimated' (same signature).

export const DURATION = {
  fast: 180,
  base: 320,
  slow: 600,
  cinema: 900,
} as const;

export const EASE = {
  out: [0.16, 1, 0.3, 1] as const, // ease-out-expo - the default for anything entering/settling
  inOut: [0.83, 0, 0.17, 1] as const, // easeInOutExpo - symmetric moves (dismiss + re-show)
  standard: [0.4, 0, 0.2, 1] as const, // material standard - small, frequent UI shifts
};
