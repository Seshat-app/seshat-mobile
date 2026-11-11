import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { LATEST_RELEASE_ID } from '../lib/releaseNotes';
import { ReleaseNotesModal } from './ReleaseNotesModal';
import { useAppLock } from '../lib/appLock';

const KEY = 'release_notes_seen';

/** Opens the What's new panel once for each new release, then remembers it. Mounted inside the signed-in app. */
export function ReleaseNotesGate() {
  const [open, setOpen] = useState(false);
  // Wait for the app lock: the panel is a native modal and would otherwise draw over the lock screen.
  const { loaded, enabled, locked } = useAppLock();
  const ready = loaded && !(enabled && locked);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    SecureStore.getItemAsync(KEY)
      .then((seen) => { if (alive && seen !== LATEST_RELEASE_ID) setOpen(true); })
      .catch(() => {});
    return () => { alive = false; };
  }, [ready]);
  const close = () => { setOpen(false); SecureStore.setItemAsync(KEY, LATEST_RELEASE_ID).catch(() => {}); };
  return <ReleaseNotesModal visible={open && ready} onClose={close} />;
}
