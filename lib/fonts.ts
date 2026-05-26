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

export function fontBody(lang: 'en' | 'ar', weight: 'regular' | 'medium' | 'semibold' = 'regular'): string {
  if (lang === 'ar') {
    if (weight === 'semibold') return FF.cairoSemiBold;
    if (weight === 'medium') return FF.cairoMedium;
    return FF.cairoRegular;
  }
  if (weight === 'semibold') return FF.syneSemiBold;
  if (weight === 'medium') return FF.syneMedium;
  return FF.syneRegular;
}

export const fontMono = (weight: 'light' | 'regular' | 'medium' = 'regular') =>
  weight === 'light' ? FF.monoLight : weight === 'medium' ? FF.monoMedium : FF.monoRegular;
