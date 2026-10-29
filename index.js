// Custom entry: the Android notification listener's Headless JS task has to be
// registered before React mounts, so Android can deliver bank notifications while
// the app is closed. Everything else is the stock expo-router entry.
import { registerBackgroundCapture } from './lib/androidNotificationListener';

registerBackgroundCapture();

import 'expo-router/entry';
