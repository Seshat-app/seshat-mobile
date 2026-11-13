import { useEffect, useState } from 'react';
import { LATEST_RELEASE_ID } from '../lib/releaseNotes';
import { ReleaseNotesModal } from './ReleaseNotesModal';
import { useAppLock } from '../lib/appLock';
import { useTermsPending } from '../lib/termsState';

import { secureGet, secureSet } from '../lib/secure';
const KEY = 'release_notes_seen';

/** Opens the What's new panel once for each new release, then remembers it. Mounted inside the signed-in app. */
export function ReleaseNotesGate() {
  const [open, setOpen] = useState(false);
  // Wait for the app lock: the panel is a native modal and would otherwise draw over the lock screen.
  const { loaded, enabled, locked } = useAppLock();
  // ...and for the Terms prompt, so two panels never stack.
  const termsPending = useTermsPending();
  const ready = loaded && !(enabled && locked) && termsPending === false;
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    secureGet(KEY)
      .then((seen) => { if (alive && seen !== LATEST_RELEASE_ID) setOpen(true); })
      .catch(() => {});
    return () => { alive = false; };
  }, [ready]);
  const close = () => { setOpen(false); secureSet(KEY, LATEST_RELEASE_ID).catch(() => {}); };
  return <ReleaseNotesModal visible={open && ready} onClose={close} />;
}
