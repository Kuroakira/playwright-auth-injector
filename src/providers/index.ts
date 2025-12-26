/**
 * Provider registry
 *
 * All authentication providers are registered here.
 * To add a new provider:
 * 1. Create a new class in src/providers/ implementing AuthProvider
 * 2. Import and register it in this file
 * 3. Add the provider name to the Provider type in src/types.ts
 */

import type { Provider } from '../types.js';
import type { AuthProvider } from './base.js';
import { FirebaseAuthProvider } from './firebase.js';
import { SupabaseAuthProvider } from './supabase.js';

// Re-export base types
export type { AuthProvider, InjectOptions } from './base.js';

// Re-export provider classes for direct usage if needed
export { FirebaseAuthProvider } from './firebase.js';
export { SupabaseAuthProvider } from './supabase.js';

/**
 * Provider registry
 *
 * Maps provider names to their implementations
 */
export const providers: Record<Provider, AuthProvider<unknown>> = {
  firebase: new FirebaseAuthProvider(),
  supabase: new SupabaseAuthProvider(),
};

/**
 * Get a provider by name
 *
 * @param name - Provider name
 * @returns The provider instance
 * @throws Error if provider not found
 */
export function getProvider(name: Provider): AuthProvider<unknown> {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return provider;
}
