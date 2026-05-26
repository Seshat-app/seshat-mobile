export type Mode = 'dark' | 'light';

export type Tokens = {
  void: string;
  surface: string;
  elevated: string;
  border: string;
  borderHi: string;
  gold: string;
  goldLight: string;
  goldDeep: string;
  bone: string;
  muted: string;
  ghost: string;
  posBg: string;
  posText: string;
  alertBg: string;
  alertText: string;
  warnBg: string;
  warnText: string;
  infoBg: string;
  infoText: string;
  navBg: string;
};

const DARK: Tokens = {
  void: '#0D0D0D',
  surface: '#1A1A1A',
  elevated: '#252525',
  border: '#2A2A2A',
  borderHi: '#3A3A3A',
  gold: '#C9A84C',
  goldLight: '#E8C97A',
  goldDeep: '#8B6B14',
  bone: '#E8E8E0',
  muted: '#888880',
  ghost: '#3A3A3A',
  posBg: '#1A3A2A',
  posText: '#4ABA7A',
  alertBg: '#3A1A1A',
  alertText: '#E05555',
  warnBg: '#3A3010',
  warnText: '#E0A030',
  infoBg: '#1A3A5A',
  infoText: '#4A8ACA',
  navBg: '#141414',
};

const LIGHT: Tokens = {
  void: '#F5F4EF',
  surface: '#EEEDE8',
  elevated: '#E5E3DC',
  border: '#D5D3CC',
  borderHi: '#B8B5AB',
  gold: '#8B6B14',
  goldLight: '#A88830',
  goldDeep: '#5E4708',
  bone: '#1A1A1A',
  muted: '#6E6E66',
  ghost: '#C8C5BC',
  posBg: '#D7E8DC',
  posText: '#1F6A3A',
  alertBg: '#EFD7D7',
  alertText: '#9A2828',
  warnBg: '#F0E2C3',
  warnText: '#8A5A0A',
  infoBg: '#D7E2EF',
  infoText: '#2A5A8A',
  navBg: '#EEEDE8',
};

export function tokens(mode: Mode): Tokens {
  return mode === 'light' ? LIGHT : DARK;
}

// Back-compat shim for older screens still importing { colors, shared } during the refactor.
// New code should call tokens(mode) via useTheme().
export const colors = {
  bg: DARK.void,
  surface: DARK.surface,
  surface2: DARK.elevated,
  surface3: DARK.border,
  text: DARK.bone,
  textDim: DARK.muted,
  textMuted: DARK.borderHi,
  gold: DARK.gold,
  goldDark: DARK.goldDeep,
  goldHover: DARK.goldLight,
  goldPale: 'rgba(201, 168, 76, 0.08)',
  border: DARK.border,
  borderDim: DARK.border,
  income: DARK.posText,
  expense: DARK.alertText,
};
