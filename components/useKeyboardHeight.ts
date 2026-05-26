import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// React Native's KeyboardAvoidingView doesn't fire reliably when its tree is
// nested inside a <Modal> on iOS (the modal lives in its own UIWindow and
// KAV's internal listeners often miss the keyboard frame change). This hook
// tracks the live keyboard height so a sheet inside a Modal can manually
// apply `marginBottom: keyboardHeight` and stay above it.
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);
  return height;
}
