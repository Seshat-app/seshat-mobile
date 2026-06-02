import { ReactNode } from 'react';
import { CalendarClock, type LucideIcon } from 'lucide-react-native';
import { apiFetch } from './api';
import { SetMonthStartSheet } from '../components/MonthStartSheet';

// ─────────────────────────────────────────────────────────────
// Setup requirements registry.
//
// A single source of truth for "data the app still needs from the user". The
// home screen's SetupPrompt reads this list, shows the first outstanding item,
// and opens its editor. Adding a NEW required field later is one entry here -
// a missing-check, a label, and the sheet that collects it. No other wiring,
// no new banner code.
//
// `isMissing` keys off the /me profile. For a field that has a sensible
// default (like monthStartDay -> 1), make sure the server returns null when
// the user has never set it, so "defaulted" and "chosen" stay distinct.
// ─────────────────────────────────────────────────────────────
export type SetupProfile = {
  monthStartDay?: number | null;
  monthlySalary?: number | null;
  displayName?: string;
  displayNameAr?: string;
};

export type SetupItem = {
  key: string;
  isMissing: (p: SetupProfile) => boolean;
  icon: LucideIcon;
  title: (lang: 'en' | 'ar') => string;
  subtitle: (lang: 'en' | 'ar') => string;
  // Render the editor that collects + persists this field. It MUST call
  // onSaved() after a successful PATCH so the prompt can refresh and advance.
  renderSheet: (args: {
    visible: boolean;
    onClose: () => void;
    onSaved: () => void;
    profile: SetupProfile;
  }) => ReactNode;
};

export const SETUP_ITEMS: SetupItem[] = [
  {
    key: 'monthStart',
    isMissing: (p) => p.monthStartDay == null,
    icon: CalendarClock,
    title: (lang) => (lang === 'ar' ? 'حدّد بداية شهرك' : 'Set your month start'),
    subtitle: (lang) => (lang === 'ar'
      ? 'متى يبدأ شهرك المالي؟ اليوم الأول افتراضياً.'
      : 'When does your financial month begin? The 1st by default.'),
    renderSheet: ({ visible, onClose, onSaved, profile }) => (
      <SetMonthStartSheet
        visible={visible}
        onClose={onClose}
        initialDay={profile.monthStartDay ?? 1}
        onSave={async (day) => {
          await apiFetch('/me', { method: 'PATCH', body: JSON.stringify({ monthStartDay: day }) });
          onSaved();
        }}
      />
    ),
  },
];
