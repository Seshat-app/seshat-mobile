import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * Sentry init for the mobile app. Called once at module-load time from
 * app/_layout.tsx, BEFORE any provider mounts so a crash during boot
 * still gets reported.
 *
 * DSN is sourced from expo-constants -> app.json -> extra.sentryDsn.
 * Put the mobile-project DSN there in plaintext (it's a public-by-design
 * value; Sentry's DSN-only auth is rate-limited and tokenless). If the
 * DSN is missing we silently no-op so dev / fresh checkout doesn't fail.
 */
export function initSentry(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, any>;
  const dsn: string | undefined = extra.sentryDsn;
  if (!dsn) return;

  Sentry.init({
    dsn,
    // Distinguish dev test events from real prod crashes in the Sentry
    // dashboard. Expo's __DEV__ flag is true when running via the dev
    // server, false in EAS / store builds.
    environment: __DEV__ ? 'development' : 'production',
    // Stamp the release with the app version + a hash of the JS bundle so
    // source maps line up. Expo handles bundle stamping automatically once
    // the sentry-expo / @sentry/react-native plugin runs at build time.
    release: Constants.expoConfig?.version ?? 'unknown',
    // 0 = errors only. Bumping this turns on performance spans, which we
    // don't need yet (and which would eat the free-tier event quota).
    tracesSampleRate: 0,
    // Don't ship the user's auth token if the failing request happens to
    // include it. Sentry sanitizes some headers by default; this is
    // belt-and-braces.
    beforeSend(event) {
      if (event.request?.headers && typeof event.request.headers === 'object') {
        delete (event.request.headers as Record<string, string>).authorization;
        delete (event.request.headers as Record<string, string>).Authorization;
      }
      return event;
    },
  });
}

export { Sentry };
