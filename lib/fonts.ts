// Font family names registered via expo-font. Loaded in app/_layout.tsx.
// PostScript family strings must match the names @expo-google-fonts/* exports.

export const FF = {
  syneRegular: 'Syne_400Regular',
  syneMedium: 'Syne_500Medium',
  syneSemiBold: 'Syne_600SemiBold',
  syneBold: 'Syne_700Bold',
  syneExtraBold: 'Syne_800ExtraBold',

  monoLight: 'DMMono_300Light',
  monoRegular: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',

  // Body — Outfit. Syne is a display face; using it for 13-17px body copy
  // and currency numbers (the old behavior) hurt legibility. Mirrors web's
  // --font-body so the two surfaces read as one product.
  outfitRegular: 'Outfit_400Regular',
  outfitMedium: 'Outfit_500Medium',
  outfitSemiBold: 'Outfit_600SemiBold',
  outfitBold: 'Outfit_700Bold',

  // Arabic — Cairo for headings AND body. Single family keeps the system
  // simple and matches what most modern Arab fintech apps (Tabby, Tamara,
  // Vodafone Cash) use. Swap by editing fontHead/fontBody if needed.
  cairoRegular: 'Cairo_400Regular',
  cairoMedium: 'Cairo_500Medium',
  cairoSemiBold: 'Cairo_600SemiBold',
  cairoBold: 'Cairo_700Bold',
  cairoExtraBold: 'Cairo_800ExtraBold',
} as const;

export function fontHead(lang: 'en' | 'ar', weight: 'regular' | 'bold' = 'bold'): string {
  if (lang === 'ar') return weight === 'bold' ? FF.cairoBold : FF.cairoRegular;
  return weight === 'bold' ? FF.syneBold : FF.syneRegular;
}

// Body text runs one step heavier than the nominal weight ("a little bolder" - regular reads thin on dark
// backgrounds): regular -> 500, medium -> 600, semibold -> 700. The names stay the same so call sites and the
// hierarchy between them are unchanged.
export function fontBody(lang: 'en' | 'ar', weight: 'regular' | 'medium' | 'semibold' = 'regular'): string {
  if (lang === 'ar') {
    if (weight === 'semibold') return FF.cairoBold;
    if (weight === 'medium') return FF.cairoSemiBold;
    return FF.cairoMedium;
  }
  if (weight === 'semibold') return FF.outfitBold;
  if (weight === 'medium') return FF.outfitSemiBold;
  return FF.outfitMedium;
}

export const fontMono = (weight: 'light' | 'regular' | 'medium' = 'regular') =>
  weight === 'light' ? FF.monoLight : weight === 'medium' ? FF.monoMedium : FF.monoRegular;
