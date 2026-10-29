import { useAppData } from './appData';

// Words a bank message carries for each currency, so the Shortcuts automation
// ("Message Contains …") follows the account's currency instead of assuming EGP.
const NAMES: Record<string, string[]> = {
  EGP: ['جنيه', 'LE'],
  SAR: ['ريال', 'SR'],
  AED: ['درهم', 'Dhs'],
  KWD: ['دينار', 'KD'],
  QAR: ['ريال', 'QR'],
  BHD: ['دينار', 'BD'],
  OMR: ['ريال', 'OMR'],
  JOD: ['دينار', 'JD'],
  USD: ['دولار', '$'],
  EUR: ['يورو', '€'],
  GBP: ['جنيه استرليني', '£'],
};

/** Currency of the active workspace (falls back to the account's, then EGP). */
export function useAccountCurrency(): string {
  const { profile, workspaces, activeLedgerId } = useAppData();
  const active = workspaces.find((w) => (activeLedgerId ? w.ledgerId === activeLedgerId : w.kind === 'personal'));
  return active?.currency || profile?.currency || 'EGP';
}

/** [code, …alternate spellings] to paste into "Message Contains". */
export function captureKeywordsFor(currency: string): string[] {
  const code = (currency || 'EGP').toUpperCase();
  return [code, ...(NAMES[code] ?? [])];
}
