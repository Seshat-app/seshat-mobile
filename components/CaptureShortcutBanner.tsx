import { useEffect, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Zap, X } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import { RCard } from './ui';
import { useAccountCurrency } from '../lib/captureKeywords';
import { getPermissionStatus } from '../lib/androidNotificationListener';

// Home-screen prompt to set up automatic bank capture (existing accounts included — the
// onboarding scene only reaches new sign-ups). iPhone: install the bank-SMS Shortcut.
// Android: allow notification access, which nothing else asks for. Gone for good once they
// open the setup guide or dismiss it; on Android also once the access is granted.
const KEY = Platform.OS === 'ios' ? 'capture_shortcut_prompt' : 'capture_android_prompt';

export function CaptureShortcutBanner() {
  const { tok, lang } = useI18n();
  const router = useRouter();
  const currency = useAccountCurrency();
  const [show, setShow] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then(async (v) => {
        if (v) return;
        if (Platform.OS === 'ios') { setShow(true); return; }
        const status = await getPermissionStatus();
        if (status !== 'authorized' && status !== 'unavailable') setShow(true);
      })
      .catch(() => {});
  }, []);

  if (!show) return null;
  const close = () => { setShow(false); SecureStore.setItemAsync(KEY, 'done').catch(() => {}); };
  const ar = lang === 'ar';

  return (
    <Pressable
      onPress={() => { close(); router.push(Platform.OS === 'ios' ? '/capture-setup-ios' : '/capture-setup-android'); }}
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
              {Platform.OS === 'ios'
                ? (ar ? 'سجّل معاملات البنك تلقائياً' : 'Log bank transactions automatically')
                : (ar ? 'سجّل إشعارات البنوك تلقائياً' : 'Log bank notifications automatically')}
            </Text>
            <Text style={{
              marginTop: 3, color: tok.muted, fontFamily: fontBody(lang), fontSize: 12,
              textAlign: ar ? 'right' : 'left',
            }}>
              {Platform.OS === 'ios'
                ? (ar ? `أتمتة واحدة على "${currency}" تكفي. جهّزها في دقيقة.` : `One automation on "${currency}" does it. Set it up in a minute.`)
                : (ar ? 'اسمح لسيشات بقراءة الإشعارات مرة واحدة، وتسجّل كل تنبيه بنكي.' : 'Allow notification access once and Seshat records every bank alert.')}
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
