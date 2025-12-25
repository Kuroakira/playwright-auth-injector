/**
 * playwright-auth-injector sample config file
 *
 * Copy this file and create `playwright-auth.config.ts`.
 */

import { defineConfig } from 'playwright-auth-injector';

export default defineConfig({
  // Provider to use: 'firebase' | 'supabase'
  provider: 'firebase',

  // Debug mode (output logs to console)
  debug: false,

  // Firebase configuration
  firebase: {
    // Service account JSON (load from environment variable)
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT!,

    // Firebase Web API Key
    apiKey: process.env.FIREBASE_API_KEY!,

    // Test user's UID
    uid: process.env.TEST_USER_UID!,
  },

  // Multiple user profiles (optional)
  // profiles: {
  //   admin: { uid: process.env.ADMIN_UID },
  //   user: { uid: process.env.USER_UID },
  // },
});
