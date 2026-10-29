import { useEffect, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Zap, X } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import { RCard } from './ui';
import { useAccountCurrency } from '../lib/captureKeywords';

// Home-screen prompt for iPhone users (existing accounts included — the onboarding
// scene only reaches new sign-ups) to install the bank-SMS capture Shortcut.
// Gone for good once they open the setup guide or dismiss it.
const KEY = 'capture_shortcut_prompt';

export function CaptureShortcutBanner() {
  const { tok, lang } = useI18n();
  const router = useRouter();
  const currency = useAccountCurrency();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    SecureStore.getItemAsync(KEY).then((v) => { if (!v) setShow(true); }).catch(() => {});
  }, []);

  if (!show) return null;
  const close = () => { setShow(false); SecureStore.setItemAsync(KEY, 'done').catch(() => {}); };
  const ar = lang === 'ar';

  return (
    <Pressable
      onPress={() => { close(); router.push('/capture-setup-ios'); }}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <RCard accent padding={14} style={{ marginHorizontal: 16, marginTop: 6, marginBottom: 12 }}>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10, backgroundColor: tok.elevated,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={18} color={tok.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{
              color: tok.bone, fontFamily: fontBody(lang, 'semibold'), fontSize: 14,
              textAlign: ar ? 'right' : 'left',
            }}>
              {ar ? 'سجّل معاملات البنك تلقائياً' : 'Log bank transactions automatically'}
            </Text>
            <Text style={{
              marginTop: 3, color: tok.muted, fontFamily: fontBody(lang), fontSize: 12,
              textAlign: ar ? 'right' : 'left',
            }}>
              {ar ? `أتمتة واحدة على "${currency}" تكفي. جهّزها في دقيقة.` : `One automation on "${currency}" does it. Set it up in a minute.`}
            </Text>
          </View>
          <Pressable onPress={close} hitSlop={10} accessibilityLabel={ar ? 'إغلاق' : 'Dismiss'}>
            <X size={16} color={tok.muted} />
          </Pressable>
          <Text style={{ color: tok.gold, fontFamily: fontMono('regular'), fontSize: 14 }}>{ar ? '←' : '→'}</Text>
        </View>
      </RCard>
    </Pressable>
  );
}
