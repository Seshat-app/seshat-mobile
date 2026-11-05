import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { HelpCircle } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { useAppData } from '../lib/appData';
import { apiFetch, hasToken } from '../lib/api';
import { fontBody, fontMono } from '../lib/fonts';
import { RCard } from './ui';

/** Home banner: "Seshat has N questions about things it captured". Hidden when there are none. */
export function ReviewBanner() {
  const { tok, lang } = useI18n();
  const { dataVersion } = useAppData();
  const router = useRouter();
  const ar = lang === 'ar';
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    hasToken().then((ok) => {
      if (!ok) return;
      apiFetch<{ data: unknown[] }>('/capture/review').then((r) => { if (alive) setCount(r.data.length); }).catch(() => {});
    });
    return () => { alive = false; };
  }, [dataVersion]);

  if (count === 0) return null;
  return (
    <Pressable onPress={() => router.push('/review')} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <RCard accent padding={14} style={{ marginHorizontal: 16, marginTop: 6, marginBottom: 12 }}>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tok.elevated, alignItems: 'center', justifyContent: 'center' }}>
            <HelpCircle size={18} color={tok.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: tok.bone, fontFamily: fontBody(lang, 'semibold'), fontSize: 14, textAlign: ar ? 'right' : 'left' }}>
              {ar ? `عندي ${count} ${count === 1 ? 'سؤال' : 'أسئلة'} عمّا رصدته` : `I have ${count} question${count === 1 ? '' : 's'} about what I captured`}
            </Text>
            <Text style={{ marginTop: 3, color: tok.muted, fontFamily: fontBody(lang), fontSize: 12, textAlign: ar ? 'right' : 'left' }}>
              {ar ? 'اضغط لتجيب في ثوانٍ.' : 'Tap to answer in a few seconds.'}
            </Text>
          </View>
          <Text style={{ color: tok.gold, fontFamily: fontMono('regular'), fontSize: 14 }}>{ar ? '←' : '→'}</Text>
        </View>
      </RCard>
    </Pressable>
  );
}
