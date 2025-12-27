import { defineConfig, devices } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment config if exists (prefer tests/e2e/playwright.env.json)
const e2eEnvPath = path.join(__dirname, "tests/e2e/playwright.env.json");
const rootEnvPath = path.join(__dirname, "playwright.env.json");
const envPath = fs.existsSync(e2eEnvPath) ? e2eEnvPath : rootEnvPath;

let configBaseURL: string | undefined;

if (fs.existsSync(envPath)) {
  const env = JSON.parse(fs.readFileSync(envPath, "utf-8"));
  if (env.baseURL) {
    configBaseURL = env.baseURL;
  }
  if (env.firebase?.serviceAccount) {
    process.env.SERVICE_ACCOUNT = JSON.stringify(env.firebase.serviceAccount);
  }
  if (env.testUser?.uid) {
    process.env.TEST_UID = env.testUser.uid;
  }
  if (env.firebase?.clientConfig) {
    process.env.FIREBASE_API_KEY = env.firebase.clientConfig.apiKey;
    process.env.FIREBASE_AUTH_DOMAIN = env.firebase.clientConfig.authDomain;
    process.env.FIREBASE_PROJECT_ID = env.firebase.clientConfig.projectId;
  }
  if (env.supabase) {
    process.env.SUPABASE_URL = env.supabase.url;
    process.env.SUPABASE_ANON_KEY = env.supabase.anonKey;
  }
  if (env.testUser) {
    process.env.TEST_EMAIL = env.testUser.email;
    process.env.TEST_PASSWORD = env.testUser.password;
  }
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [["html", { outputFolder: "playwright-report" }]],

  use: {
    baseURL: process.env.BASE_URL || configBaseURL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    ignoreHTTPSErrors: true,
  },

  projects: [
    // Auth setup (runs once before other tests)
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    // Tests that require authentication
    {
      name: "authenticated",
      testMatch: /.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
});
