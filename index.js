// Custom entry. Two things have to happen before React mounts:
//  - the Android notification listener's Headless JS task is registered, so bank
//    notifications are captured while the app is closed;
//  - the floating-bubble chat panel is registered as its own root ("SeshatChatPanel"),
//    which the native BubbleActivity renders. Everything else is the stock expo-router entry.
import { AppRegistry } from 'react-native';
import { registerBackgroundCapture } from './lib/androidNotificationListener';

registerBackgroundCapture();
AppRegistry.registerComponent('SeshatChatPanel', () => require('./components/ChatPanelRoot').default);

import 'expo-router/entry';
