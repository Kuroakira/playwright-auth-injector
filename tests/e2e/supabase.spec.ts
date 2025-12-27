import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const CONFIG_PATH = path.join(__dirname, "playwright.env.json");

// Skip if not Supabase provider
test.beforeAll(() => {
  if (!fs.existsSync(CONFIG_PATH)) {
    test.skip(true, "Config file not found");
    return;
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  if (config.provider !== "supabase") {
    test.skip(true, "Provider is not supabase");
  }
});

// Helper to get Supabase storage key
function getSupabaseStorageKey(config: { supabase?: { url?: string } }): string {
  if (!config.supabase?.url) return "";
  const url = new URL(config.supabase.url);
  const hostname = url.hostname;
  const projectRef = hostname.endsWith(".supabase.co")
    ? hostname.replace(".supabase.co", "")
    : hostname.replace(/\./g, "-");
  return `sb-${projectRef}-auth-token`;
}

test.describe("Supabase Authentication E2E", () => {
  test("should be authenticated after setup", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");

    // Verify we're not redirected to login
    await expect(page).not.toHaveURL(/login|signin|auth/i);
  });

  test("should have valid localStorage auth state", async ({ page }) => {
    await page.goto("/");

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    const storageKey = getSupabaseStorageKey(config);

    // Check localStorage contains Supabase auth data
    const authData = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, storageKey);

    expect(authData).not.toBeNull();

    // Verify it's valid JSON with expected structure
    const parsed = JSON.parse(authData!);
    expect(parsed).toHaveProperty("access_token");
    expect(parsed).toHaveProperty("refresh_token");
    expect(parsed).toHaveProperty("user");
  });

  test("should have valid access token", async ({ page }) => {
    await page.goto("/");

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    const storageKey = getSupabaseStorageKey(config);

    const authData = await page.evaluate((key) => {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    }, storageKey);

    expect(authData).not.toBeNull();
    expect(authData.access_token).toBeTruthy();
    expect(typeof authData.access_token).toBe("string");
    expect(authData.access_token.length).toBeGreaterThan(0);
  });

  test("should persist auth state after reload", async ({ page }) => {
    await page.goto("/");

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    const storageKey = getSupabaseStorageKey(config);

    // Get initial auth state
    const initialAuthData = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, storageKey);

    // Reload the page
    await page.reload();

    // Get auth state after reload
    const reloadedAuthData = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, storageKey);

    expect(initialAuthData).not.toBeNull();
    expect(reloadedAuthData).not.toBeNull();
    expect(initialAuthData).toBe(reloadedAuthData);
  });

  test("should have user info in auth data", async ({ page }) => {
    await page.goto("/");

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    const storageKey = getSupabaseStorageKey(config);

    const authData = await page.evaluate((key) => {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    }, storageKey);

    expect(authData).not.toBeNull();
    expect(authData.user).toBeDefined();
    expect(authData.user.email).toBe(config.testUser.email);
  });
});
