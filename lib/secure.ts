import * as SecureStore from 'expo-secure-store';

/**
 * Small, never-throwing wrapper around the keychain / keystore.
 *
 * iPhone: with the default setting an item can only be read while the phone is unlocked. The app is sometimes woken in
 * the background (a push, a widget refresh, an automation) while the phone is locked, and every read then failed with
 * "getValueWithKeyAsync has failed" as an unhandled promise rejection (Sentry REACT-NATIVE-7). New writes therefore use
 * AFTER_FIRST_UNLOCK, and a failed read just returns null, so nothing in the app depends on the phone being unlocked.
 * Android ignores the setting.
 */
export const SECURE_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

export async function secureGet(key: string): Promise<string | null> {
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}

export async function secureSet(key: string, value: string): Promise<void> {
  try { await SecureStore.setItemAsync(key, value, SECURE_OPTIONS); } catch { /* keep going; the value is a preference */ }
}

export async function secureDelete(key: string): Promise<void> {
  try { await SecureStore.deleteItemAsync(key); } catch { /* nothing to delete, or locked */ }
}

/**
 * Items saved by older builds were stored "only while unlocked". Re-save the sign-in token once per launch so it is
 * readable after the first unlock like everything new. A failure is ignored (it will be tried again next launch).
 */
export async function upgradeKeychainAccess(keys: string[] = ['auth_token']): Promise<void> {
  for (const k of keys) {
    const v = await secureGet(k);
    if (v) await secureSet(k, v);
  }
}
