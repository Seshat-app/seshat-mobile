import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

// ─────────────────────────────────────────────────────────────
// useRecorder — wraps expo-audio's recorder in a tap-and-hold
// friendly hook. Returns `start()`, `stop()`, and `isRecording`.
//
// `stop()` resolves with `{ base64, format }` so the caller can
// upload to the backend without needing to know anything about
// the file system. Returns null on no-permission or empty clip.
//
// (expo-audio replaced expo-av, which Expo removed in SDK 55.)
// ─────────────────────────────────────────────────────────────
export type RecordingResult = { base64: string; format: 'm4a' | 'wav' } | null;

export function useRecorder() {
  const recordingRef = useRef<AudioRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [permissionAsked, setPermissionAsked] = useState(false);

  // Make sure any in-flight recording is torn down on unmount so we don't
  // leave the mic warm or the audio session in record mode.
  useEffect(() => {
    return () => {
      const rec = recordingRef.current;
      if (rec) {
        rec.stop().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const existing = await getRecordingPermissionsAsync();
    if (existing.granted) return true;
    if (!permissionAsked) setPermissionAsked(true);
    const req = await requestRecordingPermissionsAsync();
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
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      const rec = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await rec.prepareToRecordAsync();
      rec.record();
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
      await rec.stop();
      const uri = rec.uri;
      if (!uri) return null;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Reset the audio session so playback works normally afterward.
      await setAudioModeAsync({ allowsRecording: false });
      // The HIGH_QUALITY preset records AAC in an m4a container on both iOS and Android.
      if (!base64) return null;
      return { base64, format: 'm4a' };
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
      await rec.stop();
      const uri = rec.uri;
      if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
      await setAudioModeAsync({ allowsRecording: false });
    } catch { /* ignore */ }
  }, []);

  return { start, stop, cancel, isRecording };
}
