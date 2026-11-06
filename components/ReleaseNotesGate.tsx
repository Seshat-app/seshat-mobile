import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { LATEST_RELEASE_ID } from '../lib/releaseNotes';
import { ReleaseNotesModal } from './ReleaseNotesModal';

const KEY = 'release_notes_seen';

/** Opens the What's new panel once for each new release, then remembers it. Mounted inside the signed-in app. */
export function ReleaseNotesGate() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync(KEY)
      .then((seen) => { if (alive && seen !== LATEST_RELEASE_ID) setOpen(true); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const close = () => { setOpen(false); SecureStore.setItemAsync(KEY, LATEST_RELEASE_ID).catch(() => {}); };
  return <ReleaseNotesModal visible={open} onClose={close} />;
}
