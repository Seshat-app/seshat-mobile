import { useEffect, useRef, useState } from 'react';
import {
  Modal, Pressable, Animated, useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';

/**
 * Full-screen image viewer (lightbox). Tap any image around the app to open it
 * here at full size against a dark backdrop.
 *
 * Built on the built-in Modal + RN Animated (the same primitives every other
 * overlay in the app uses — see AddOptionsSheet) rather than a gesture/zoom
 * library: react-native-gesture-handler + reanimated ship as transitive deps
 * but aren't wired up (no GestureHandlerRootView at the root, no worklets babel
 * plugin), so a pinch implementation would need infra changes. Instead we offer
 * a lightweight double-tap-to-zoom toggle, which covers the common "let me read
 * the small print on this receipt" need without new dependencies.
 *
 * Dismiss: the ✕ button, a single tap on the backdrop/image, or the Android
 * back button. Double-tap toggles a centred 2.4× zoom.
 */

type Props = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
};

const ZOOM = 2.4;

export function ImageViewer({ visible, uri, onClose }: Props) {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const backdrop = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [zoomed, setZoomed] = useState(false);

  // Refs so the tap handler reads live values without re-subscribing.
  const zoomedRef = useRef(false);
  const lastTap = useRef(0);
  const singleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    zoomedRef.current = zoomed;
  }, [zoomed]);

  // Fade the backdrop in on open; reset zoom whenever the sheet toggles.
  useEffect(() => {
    Animated.timing(backdrop, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    if (!visible) {
      scale.setValue(1);
      setZoomed(false);
      zoomedRef.current = false;
    }
    return () => {
      if (singleTimer.current) {
        clearTimeout(singleTimer.current);
        singleTimer.current = null;
      }
    };
  }, [visible]);

  const setZoom = (on: boolean) => {
    setZoomed(on);
    zoomedRef.current = on;
    Animated.spring(scale, {
      toValue: on ? ZOOM : 1,
      useNativeDriver: true,
      friction: 7,
      tension: 80,
    }).start();
  };

  // One handler drives both gestures: a quick second tap zooms, a lone tap
  // (after a short wait) either resets the zoom or dismisses the viewer.
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 260) {
      if (singleTimer.current) {
        clearTimeout(singleTimer.current);
        singleTimer.current = null;
      }
      lastTap.current = 0;
      setZoom(!zoomedRef.current);
      return;
    }
    lastTap.current = now;
    singleTimer.current = setTimeout(() => {
      singleTimer.current = null;
      if (zoomedRef.current) setZoom(false);
      else onClose();
    }, 260);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar style="light" />
      <Animated.View style={{ flex: 1, backgroundColor: '#000000', opacity: backdrop }}>
        <Pressable
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          onPress={handleTap}
          accessibilityRole="imagebutton"
          accessibilityLabel={lang === 'ar' ? 'إغلاق معاينة الصورة' : 'Close image preview'}
        >
          {uri ? (
            <Animated.Image
              source={{ uri }}
              resizeMode="contain"
              style={{ width, height, transform: [{ scale }] }}
            />
          ) : null}
        </Pressable>

        {/* Close affordance — sits on the trailing top corner, mirroring the
            app's RTL handling (right for LTR, left for Arabic). */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={lang === 'ar' ? 'إغلاق' : 'Close'}
          style={({ pressed }) => ({
            position: 'absolute',
            top: insets.top + 8,
            ...(lang === 'ar' ? { left: 16 } : { right: 16 }),
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.14)',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <X size={22} color={tok.bone} strokeWidth={2} />
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
