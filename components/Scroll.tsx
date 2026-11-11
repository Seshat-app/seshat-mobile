import { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ScrollView as RNScrollView,
  FlatList as RNFlatList,
  Keyboard,
  Platform,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';

// Drop-in ScrollView / FlatList that don't clip at the top edge, so content can slide
// up underneath a FrostedHeader (see ./FrostedHeader) and show blurred through it.
// Everything else behaves exactly like the react-native components.
const VISIBLE = { overflow: 'visible' } as const;

/** Anything with `measureInWindow`: a TextInput or a View. */
type Measurable = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void };

/**
 * A field calls this when it gains focus so the scroll view around it can bring it into view above the keyboard.
 * Outside a keyboard-aware scroll view it is null and nothing happens.
 */
const RevealContext = createContext<((node: Measurable | null) => void) | null>(null);
export const useRevealOnFocus = () => useContext(RevealContext);

/**
 * Keyboard-aware: when a field inside it is focused, the view scrolls just enough to show that field above the
 * keyboard, and keeps room under the content so the last field can reach the top of the keyboard. It measures where the
 * keyboard really is, so it works the same whether or not the phone resizes the window for it, and inside a Modal.
 */
export const ScrollView = forwardRef<RNScrollView, ScrollViewProps>(function ScrollView(
  { style, onScroll, children, keyboardShouldPersistTaps, ...rest },
  fwd,
) {
  const ref = useRef<RNScrollView>(null);
  useImperativeHandle(fwd, () => ref.current as RNScrollView);
  const y = useRef(0);
  const kbTop = useRef<number | null>(null);
  const target = useRef<Measurable | null>(null);
  const [pad, setPad] = useState(0);

  const place = useCallback(() => {
    const sv = ref.current as unknown as Measurable | null;
    const node = target.current;
    if (!sv || !node) return;
    sv.measureInWindow((_x, vy, _w, vh) => {
      const bottom = vy + vh;
      const limit = kbTop.current !== null ? Math.min(bottom, kbTop.current) : bottom;
      setPad(kbTop.current !== null ? Math.max(0, Math.round(bottom - limit)) : 0);
      node.measureInWindow((_ix, iy, _iw, ih) => {
        const margin = 24;
        const over = iy + ih + margin - limit;
        const under = vy + margin - iy;
        if (over > 0) ref.current?.scrollTo({ y: y.current + over, animated: true });
        else if (under > 0) ref.current?.scrollTo({ y: Math.max(0, y.current - under), animated: true });
      });
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const onShow = Keyboard.addListener(showEvent, (e) => {
      kbTop.current = e.endCoordinates.screenY;
      if (target.current) {
        place();
        setTimeout(place, 140); // again once the room under the content has been laid out
      }
    });
    const onHide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      kbTop.current = null;
      target.current = null;
      setPad(0);
    });
    return () => { onShow.remove(); onHide.remove(); };
  }, [place]);

  const reveal = useMemo(() => (node: Measurable | null) => {
    target.current = node;
    if (node && kbTop.current !== null) { setTimeout(place, 60); setTimeout(place, 200); }
  }, [place]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    y.current = e.nativeEvent.contentOffset.y;
    onScroll?.(e);
  };

  return (
    <RevealContext.Provider value={reveal}>
      <RNScrollView
        ref={ref}
        style={[VISIBLE, style]}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? 'handled'}
        onScroll={handleScroll}
        scrollEventThrottle={rest.scrollEventThrottle ?? 16}
        {...rest}
      >
        {children}
        {pad > 0 ? <View style={{ height: pad }} /> : null}
      </RNScrollView>
    </RevealContext.Provider>
  );
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FlatList = forwardRef<any, any>(function FlatList({ style, ...rest }, ref) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = { ...rest, style: [VISIBLE, style] } as any;
  return <RNFlatList ref={ref} {...props} />;
}) as unknown as typeof RNFlatList;
// Type side, so `useRef<FlatList<Message>>` keeps working.
export type FlatList<ItemT = unknown> = RNFlatList<ItemT>;
