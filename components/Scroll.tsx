import { forwardRef } from 'react';
import {
  ScrollView as RNScrollView,
  FlatList as RNFlatList,
  type ScrollViewProps,
} from 'react-native';

// Drop-in ScrollView / FlatList that don't clip at the top edge, so content can slide
// up underneath a FrostedHeader (see ./FrostedHeader) and show blurred through it.
// Everything else behaves exactly like the react-native components.
const VISIBLE = { overflow: 'visible' } as const;

export const ScrollView = forwardRef<RNScrollView, ScrollViewProps>(function ScrollView(
  { style, ...rest },
  ref,
) {
  return <RNScrollView ref={ref} style={[VISIBLE, style]} {...rest} />;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FlatList = forwardRef<any, any>(function FlatList({ style, ...rest }, ref) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = { ...rest, style: [VISIBLE, style] } as any;
  return <RNFlatList ref={ref} {...props} />;
}) as unknown as typeof RNFlatList;
// Type side, so `useRef<FlatList<Message>>` keeps working.
export type FlatList<ItemT = unknown> = RNFlatList<ItemT>;
