import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { fontBody } from '../lib/fonts';
import { RCard, REyebrow } from './ui';

type Status = { lastCapturedAt: string | null; last7Days: number };

function ago(iso: string, ar: boolean): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return ar ? 'الآن' : 'just now';
  if (mins < 60) return ar ? `منذ ${mins} دقيقة` : `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return ar ? `منذ ${hrs} ساعة` : `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return ar ? `منذ ${days} يوم` : `${days} d ago`;
}

/**
 * Is automatic logging reaching this account? The last captured message and how many came in this week, so a silent
 * setup problem is visible. Pass `permissionOff` (Android) when notification access is not granted.
 */
export function CaptureStatus({ permissionOff }: { permissionOff?: boolean }) {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const [s, setS] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ data: Status }>('/capture/status').then((r) => { setS(r.data); setFailed(false); }).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const working = !!s?.lastCapturedAt && s.last7Days > 0;
  const Icon = working && !permissionOff ? CheckCircle2 : AlertCircle;
  const color = working && !permissionOff ? tok.gold : tok.alertText;
  let line: string;
  if (failed) line = ar ? 'تعذّر قراءة الحالة الآن.' : 'Could not read the status right now.';
  else if (!s) line = '…';
  else if (permissionOff) line = ar ? 'صلاحية الإشعارات غير مفعّلة، لذلك لا يُسجَّل شيء تلقائياً.' : 'Notification access is off, so nothing is logged automatically.';
  else if (!s.lastCapturedAt) line = ar ? 'لم يُسجَّل شيء تلقائياً بعد. إذا وصلتك رسائل بنك، أكمل الإعداد أدناه.' : 'Nothing has been logged automatically yet. If you have received bank messages, finish the setup below.';
  else line = ar
    ? `آخر رسالة سُجّلت ${ago(s.lastCapturedAt, true)} · ${s.last7Days} خلال ٧ أيام`
    : `Last message logged ${ago(s.lastCapturedAt, false)} · ${s.last7Days} in the last 7 days`;

  return (
    <RCard padding={16} style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Icon size={18} color={color} />
        <REyebrow>{ar ? 'حالة التسجيل التلقائي' : 'Automatic logging'}</REyebrow>
      </View>
      <Text style={{ fontFamily: fontBody(lang), fontSize: 13.5, lineHeight: 20, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{line}</Text>
    </RCard>
  );
}
