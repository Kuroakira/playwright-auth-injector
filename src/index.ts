import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { FirebaseProvider } from "./providers/firebase.js";
import { SupabaseProvider } from "./providers/supabase.js";
import type { AuthProvider } from "./providers/base.js";
import type { AuthSetupOptions, PlaywrightAuthConfig } from "./types.js";

// Re-export types for library consumers
export type {
  AuthSetupOptions,
  PlaywrightAuthConfig,
  ProviderType,
  TestUser,
  FirebaseConfig,
  SupabaseConfig,
  NextAuthConfig,
} from "./types.js";

export type { AuthProvider } from "./providers/base.js";
export { FirebaseProvider } from "./providers/firebase.js";
export { SupabaseProvider } from "./providers/supabase.js";

/**
 * Create an authentication provider from a configuration file.
 *
 * This function reads the config file, determines the provider type,
 * and returns the appropriate provider instance.
 *
 * @example
 * ```typescript
 * import { createProviderFromConfigFile } from 'playwright-nextjs-auth';
 *
 * const provider = createProviderFromConfigFile('./playwright.env.json');
 * await provider.signIn(page);
 * ```
 */
export function createProviderFromConfigFile(configPath: string): AuthProvider {
  const absolutePath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `Configuration file not found: ${absolutePath}\n` +
        `Please create the file from playwright.env.json.sample`
    );
  }

  const content = fs.readFileSync(absolutePath, "utf-8");
  let rawConfig: PlaywrightAuthConfig;

  try {
    rawConfig = JSON.parse(content);
  } catch {
    throw new Error(
      `Failed to parse configuration file: ${absolutePath}\n` +
        `Please ensure the file contains valid JSON`
    );
  }

  if (!rawConfig.provider) {
    throw new Error('Configuration must specify "provider" field');
  }

  switch (rawConfig.provider) {
    case "firebase":
      return FirebaseProvider.fromConfigFile(configPath);

    case "supabase":
      return SupabaseProvider.fromConfigFile(configPath);

    default:
      throw new Error(
        `Unknown provider: ${rawConfig.provider}. Supported: firebase, supabase`
      );
  }
}

/**
 * Ensure output directory exists
 */
export function ensureOutputDir(outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

/**
 * Main authentication setup function.
 *
 * This function:
 * 1. Loads configuration from the specified JSON file
 * 2. Launches a browser and creates a new page
 * 3. Executes authentication via the appropriate provider
 * 4. Saves the authentication state (cookies, localStorage, IndexedDB)
 *
 * @example
 * ```typescript
 * // In global-setup.ts or auth.setup.ts
 * import { authSetup } from 'playwright-nextjs-auth';
 *
 * export default async function globalSetup() {
 *   await authSetup({
 *     configPath: './playwright.env.json',
 *     outputDir: 'e2e/.auth',
 *     baseURL: 'http://localhost:3000'
 *   });
 * }
 * ```
 */
export async function authSetup(options: AuthSetupOptions): Promise<void> {
  const {
    configPath,
    outputDir = "e2e/.auth",
    baseURL,
    storageStateFile = "user.json",
  } = options;

  // 1. Create provider from config
  console.log(`[AuthSetup] Loading configuration from: ${configPath}`);
  const provider = createProviderFromConfigFile(configPath);
  console.log(`[AuthSetup] Provider created`);

  // 2. Ensure output directory exists
  ensureOutputDir(outputDir);
  const storageStatePath = path.join(outputDir, storageStateFile);

  // 3. Launch browser
  console.log("[AuthSetup] Launching browser...");
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    console.log("[AuthSetup] Starting authentication...");
    await provider.signIn(page);

    // 4. Save storage state (including IndexedDB for Firebase)
    console.log(`[AuthSetup] Saving storage state to: ${storageStatePath}`);
    await context.storageState({
      path: storageStatePath,
      indexedDB: true, // Required for Firebase
    });

    console.log("[AuthSetup] Authentication setup complete!");
  } catch (error) {
    console.error("[AuthSetup] Authentication failed:", error);
    throw error;
  } finally {
    await browser.close();
  }
}
