import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { hapticLight } from './press';
import { fontMono } from '../lib/fonts';
import { useI18n } from '../lib/i18n';
import { toggleHideNumbers, useHideNumbers } from '../lib/privacy';
import { RAmount } from './ui';
import type { ComponentProps } from 'react';

import { secureGet, secureSet } from '../lib/secure';
const HINT_KEY = 'hide_numbers_hint_seen';

/**
 * The hero balance IS the hide/show control: tap the number to turn every amount in the app into •••• (tap again to
 * show). No button to place. A one-line hint appears until the first time it is used; while hidden a small
 * "tap to show" reminds how to bring the numbers back.
 */
export function BalanceAmount(props: ComponentProps<typeof RAmount> & { eye?: number; center?: boolean; caption?: boolean }) {
  const { eye: _eye, center, caption: showCaption = true, ...amount } = props;
  const { tok, lang } = useI18n();
  const hidden = useHideNumbers();
  const ar = lang === 'ar';
  const [hintSeen, setHintSeen] = useState(true);
  useEffect(() => {
    secureGet(HINT_KEY).then((v) => setHintSeen(!!v)).catch(() => {});
  }, []);
  const onPress = () => {
    hapticLight();
    toggleHideNumbers();
    if (!hintSeen) { setHintSeen(true); secureSet(HINT_KEY, '1').catch(() => {}); }
  };
  const caption = !showCaption ? null : hidden
    ? (ar ? 'اضغط لإظهار الأرقام' : 'Tap to show numbers')
    : (!hintSeen ? (ar ? 'اضغط على الرقم لإخفاء المبالغ' : 'Tap the number to hide amounts') : null);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hidden ? (ar ? 'إظهار الأرقام' : 'Show numbers') : (ar ? 'إخفاء الأرقام' : 'Hide numbers')}
      style={{ alignSelf: center ? 'center' : (ar ? 'flex-end' : 'flex-start'), alignItems: center ? 'center' : undefined }}
    >
      <RAmount {...amount} />
      {caption ? (
        <Text style={{ marginTop: 6, fontFamily: fontMono('regular'), fontSize: 10.5, letterSpacing: 0.6, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}
