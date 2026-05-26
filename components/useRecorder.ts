import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

// ─────────────────────────────────────────────────────────────
// useRecorder — wraps expo-av's recording API in a tap-and-hold
// friendly hook. Returns `start()`, `stop()`, and `isRecording`.
//
// `stop()` resolves with `{ base64, format }` so the caller can
// upload to the backend without needing to know anything about
// the file system. Returns null on no-permission or empty clip.
// ─────────────────────────────────────────────────────────────
export type RecordingResult = { base64: string; format: 'm4a' | 'wav' } | null;

export function useRecorder() {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [permissionAsked, setPermissionAsked] = useState(false);

  // Make sure any in-flight recording is torn down on unmount so we don't
  // leave the mic warm or the audio session in record mode.
  useEffect(() => {
    return () => {
      const rec = recordingRef.current;
      if (rec) {
        rec.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const existing = await Audio.getPermissionsAsync();
    if (existing.granted) return true;
    if (!permissionAsked) setPermissionAsked(true);
    const req = await Audio.requestPermissionsAsync();
    if (!req.granted) {
      Alert.alert(
        'Microphone access needed',
        'Enable microphone access in Settings to talk to Seshat.',
      );
      return false;
    }
    return true;
  }, [permissionAsked]);

  const start = useCallback(async (): Promise<boolean> => {
    if (isRecording) return false;
    const ok = await ensurePermission();
    if (!ok) return false;

    try {
      // Routes audio through the recording session so iOS will actually open
      // the mic; without this the recording silently captures nothing.
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recordingRef.current = rec;
      setIsRecording(true);
      return true;
    } catch (err) {
      console.warn('[useRecorder] start failed', err);
      recordingRef.current = null;
      setIsRecording(false);
      return false;
    }
  }, [isRecording, ensurePermission]);

  const stop = useCallback(async (): Promise<RecordingResult> => {
    const rec = recordingRef.current;
    if (!rec) return null;
    recordingRef.current = null;
    setIsRecording(false);
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) return null;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Reset the audio session so playback works normally afterward.
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      // expo-av HIGH_QUALITY preset records m4a on iOS and wav on Android by
      // default. We send m4a always — Android's wav is also supported by Whisper.
      const format = Platform.OS === 'ios' ? 'm4a' : 'wav';
      if (!base64) return null;
      return { base64, format };
    } catch (err) {
      console.warn('[useRecorder] stop failed', err);
      return null;
    }
  }, []);

  // Cancel without uploading (e.g. user dragged off the button).
  const cancel = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    recordingRef.current = null;
    setIsRecording(false);
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch { /* ignore */ }
  }, []);

  return { start, stop, cancel, isRecording };
}
