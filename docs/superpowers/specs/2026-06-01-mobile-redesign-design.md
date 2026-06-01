# Seshat Mobile — Ground-Up Visual Redesign

Date: 2026-06-01
Status: Direction approved (Home flagship mockup signed off)
Owner: Mo'men Khaled

## Goal

Rebuild the Seshat mobile app's visual language to match the premium
gold-on-void / glass identity of the marketing web, while keeping the app
ergonomic for daily use. The brand language is shared with the web; the
layout density stays app-appropriate (scannable, fast, touch-first).

Brand law: Seshat is the product/scribe. Maat is the AI assistant. The word
"Radar" never appears. No em-dashes and no use of the word "temple" in any
user-facing copy.

## What this is NOT

- Not a change to information architecture, navigation structure, flows, or
  data. Same tabs, same screens, same features.
- Not a marketing-grade spacing transplant. The app stays dense enough to be
  a useful finance tool.
- Not a token rewrite. We build on the existing tokens in `lib/theme.ts`.

---

## The locked design language

All values reference existing tokens (`lib/theme.ts`): gold `#C9A84C`,
goldLight `#E8C97A`, void `#0D0D0D`, surface `#1A1A1A`, elevated `#252525`,
border `#2A2A2A`, borderHi `#3A3A3A`, bone `#E8E8E0`, muted `#888880`,
pos `#4ABA7A`, alert `#E05555`. Fonts: Syne (head + EN body), DM Mono
(numbers + eyebrows), Cairo (Arabic).

### 1. Atmosphere (the foundation)

Screens are no longer flat black. A reusable background layer paints the void
with soft gold radial washes plus a faint film grain, giving the same lit
depth as the web.

- Top wash: gold radial, center-top, ~13% peak opacity, fading by ~58% radius.
- Secondary wash: dimmer, upper-right, ~5%.
- Bottom wash: dim, ~5%, anchors the tab bar region.
- Grain: fractal-noise SVG, fixed, ~3.5% opacity, `pointerEvents=none`,
  above background but below content.

Implemented once as `<ScreenAtmosphere>` (an absolute-fill layer) and dropped
behind every screen's content. RN: gradients via `expo-linear-gradient` /
`react-native-svg` RadialGradient; grain via a tiled PNG/SVG asset.

### 2. Card system — the "golden shield" (double-bezel)

Every card is a nested enclosure: an outer shell (the tray) wrapping an inner
core (the plate). Replaces today's flat single-surface card.

- Outer shell: padding 5, radius 28, `bg rgba(255,255,255,0.035)`,
  `border 1px rgba(255,255,255,0.06)`.
- Inner core: radius 23, padding 22 (or per-card), background vertical
  gradient `#1C1C1C → #151515`, inset top sheen
  `inset 0 1px 0 rgba(255,255,255,0.06)`.
- Concentric corners: inner radius = outer radius − shell padding.

Variant: **glow** (focal cards only — hero, Maat insight).

- Shell background: `linear-gradient(180deg, rgba(201,168,76,0.14), rgba(201,168,76,0.03))`.
- Shell border: `1px rgba(201,168,76,0.30)`.
- Shell drop glow: soft gold, e.g. iOS `shadowColor #C9A84C, opacity ~0.30,
  radius ~22, offset y 10`; Android elevation ~6.
- Inner core top sheen tinted gold: `inset 0 1px 0 rgba(201,168,76,0.28)`.

Non-glow tiles (income/expense, lists) use the plain shell + core. Dense list
cards may reduce inner padding but keep the shell.

Note: RN has no `backdrop-blur` on scrolling content (perf). The glass look
comes from the bezel + sheen + gradient + glow, NOT from runtime blur. Blur is
reserved for fixed elements only (tab bar, sheets, overlays).

### 3. Header

Two bands, generous, brand-anchored:

- Top band: glass workspace chip (gold dot + ledger name + chevron) on the
  leading side; a circular seal medallion (the crosshair-burst mark in a
  gold-tinted glass disc with a soft halo) on the trailing side.
- Greeting band: two-line greeting in Syne ~27 (bone, tight tracking) with a
  DM Mono date/stat eyebrow below (`JUNE 2026 · 47 ENTRIES`, the stat in
  gold). The view switcher moves here as a compact segmented pill on the
  trailing side (3 icons: bars / instrument / grid; active = gold-lit).

RTL: bands mirror; greeting + eyebrow right-aligned; Cairo; tracking 0.

### 4. Floating glass tab bar

Detached rounded pill, not a glued bar.

- `bg rgba(22,22,22,0.72)`, `border 1px rgba(255,255,255,0.08)`,
  `backdrop-blur 20` (fixed element, allowed), soft drop shadow.
- Active tab: full opacity + a small gold dot under it; inactive ~50%.
- Maat tab uses the seal glyph. The gold FAB floats above the bar on the
  trailing side (existing long-press-to-talk behavior preserved).
- A bottom gradient fade (void, 0 → 1) sits behind the bar so scrolling
  content dissolves into it.

### 5. Type & spacing rhythm

- Eyebrows: DM Mono, 10.5–11, letter-spacing ~2.2, uppercase, muted (gold for
  section/active).
- Numbers: DM Mono medium, tight negative tracking; hero ~46, tiles ~23.
- Headlines: Syne 700, negative tracking.
- Spacing: lean on the `S` scale; cards breathe more than today (inner padding
  ~22 on focal cards, section gaps ~24).

### 6. Motion (implied)

- Cards fade-up + settle on mount/scroll-in (staggered).
- Seal: one-shot draw-in on load; continuous spin while refreshing (unchanged).
- FAB: press scale-down; gold glow. Tab change: calm cross-fade of the active
  dot.
- Sparkbar "today" bar has a gold glow.

### 7. Light mode + Arabic

Both must carry through. Light mode uses the LIGHT token set (parchment void,
deep gold). The atmosphere wash + bezels adapt (sheen becomes a brighter
white inset per LIGHT `sheen`). Arabic mirrors layout, swaps Cairo, sets
letter-spacing 0, and uses the Arabic name for greetings when set.

### 8. Responsiveness (its own track, non-negotiable)

Concrete rules applied to every screen:

- No fixed widths on content; use flex + percentages. No fixed heights on
  text containers.
- Horizontal padding and the type scale derive from viewport width (small
  phones e.g. iPhone SE/13 mini get a tighter step; large/Plus/Max get the
  base or a touch more).
- All screens respect `useSafeAreaInsets()` top and bottom; the floating tab
  bar + FAB offsets derive from the bottom inset.
- Long strings (names, categories, amounts) truncate or wrap gracefully;
  greeting and amounts tested at the longest realistic values.
- Verified on at least a small (≤375pt) and a large (≥430pt) device.

---

## Shared primitive layer (build first)

These are the reusable units every screen composes from. Build and verify
this layer before re-skinning screens, so the language propagates once.

1. `ScreenAtmosphere` — absolute-fill gold-wash + grain background layer.
2. `RCard` (rework) — double-bezel shell+core, with `glow` and padding props;
   keep the existing API so call sites need minimal change.
3. `RHomeHeader` (rework) — the two-band header above.
4. `RSegmented` — the compact view-switcher pill (extract from header).
5. `RTabBar` — floating glass tab bar (replaces the default expo-router bar)
   + the existing `RFAB` repositioned to the new bar.
6. `RSeal` medallion wrapper — seal in a gold glass disc with halo (reuses
   `SeshatMark`).
7. Eyebrow / amount / status primitives (`REyebrow`, `RAmount`, `RStatus`)
   re-tuned to the rhythm above.

---

## Screen inventory & phase order

Each phase: re-skin in the language → screenshot on a small + large device →
confirm before moving on.

- **Phase 0 — Foundation:** the shared primitive layer above. Land it behind
  the existing Home so Home visibly transforms first.
- **Phase 1 — Core daily screens:** Home (all 3 dashboard variants), the
  Add/capture sheet, Records/Transactions list, Maat chat (list + thread).
- **Phase 2 — Secondary:** Profile, Budgets, Goals, Debts, Categories,
  Reminders, Reports, Orgs/Workspace, Support.
- **Phase 3 — Edges:** Auth/onboarding entry, empty states, skeletons,
  salary banners + sheets, error/unauthorized.

## Success criteria

- A new screen is indistinguishable in language from the Home flagship.
- The app reads as the same product as the web without copying its density.
- Every screen passes the responsiveness rules on small + large devices.
- Light mode and Arabic both hold up.
- No regressions to flows, data, or the loading-indicator coverage already
  shipped.
