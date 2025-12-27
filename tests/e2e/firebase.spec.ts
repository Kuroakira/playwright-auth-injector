import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const CONFIG_PATH = path.join(__dirname, "playwright.env.json");

// Skip if not Firebase provider
test.beforeAll(() => {
  if (!fs.existsSync(CONFIG_PATH)) {
    test.skip(true, "Config file not found");
    return;
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  if (config.provider !== "firebase") {
    test.skip(true, "Provider is not firebase");
  }
});

test.describe("Firebase Authentication E2E", () => {
  test("should be authenticated after setup", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");

    // Verify we're not redirected to login
    // (adjust this based on your app's behavior)
    await expect(page).not.toHaveURL(/login|signin|auth/i);
  });

  test("should have valid IndexedDB auth state", async ({ page }) => {
    await page.goto("/");

    // Check IndexedDB contains Firebase auth data
    const hasAuthData = await page.evaluate(async () => {
      return new Promise<boolean>((resolve) => {
        const request = indexedDB.open("firebaseLocalStorageDb");
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("firebaseLocalStorage")) {
            db.close();
            resolve(false);
            return;
          }
          const tx = db.transaction(["firebaseLocalStorage"], "readonly");
          const store = tx.objectStore("firebaseLocalStorage");
          const countRequest = store.count();
          countRequest.onsuccess = () => {
            db.close();
            resolve(countRequest.result > 0);
          };
          countRequest.onerror = () => {
            db.close();
            resolve(false);
          };
        };
        request.onerror = () => resolve(false);
      });
    });

    expect(hasAuthData).toBe(true);
  });

  test("should persist auth state after reload", async ({ page }) => {
    await page.goto("/");

    // Get initial auth state
    const initialAuthState = await page.evaluate(async () => {
      return new Promise<string | null>((resolve) => {
        const request = indexedDB.open("firebaseLocalStorageDb");
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("firebaseLocalStorage")) {
            db.close();
            resolve(null);
            return;
          }
          const tx = db.transaction(["firebaseLocalStorage"], "readonly");
          const store = tx.objectStore("firebaseLocalStorage");
          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => {
            db.close();
            resolve(JSON.stringify(getAllRequest.result));
          };
        };
        request.onerror = () => resolve(null);
      });
    });

    // Reload the page
    await page.reload();

    // Get auth state after reload
    const reloadedAuthState = await page.evaluate(async () => {
      return new Promise<string | null>((resolve) => {
        const request = indexedDB.open("firebaseLocalStorageDb");
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("firebaseLocalStorage")) {
            db.close();
            resolve(null);
            return;
          }
          const tx = db.transaction(["firebaseLocalStorage"], "readonly");
          const store = tx.objectStore("firebaseLocalStorage");
          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => {
            db.close();
            resolve(JSON.stringify(getAllRequest.result));
          };
        };
        request.onerror = () => resolve(null);
      });
    });

    expect(initialAuthState).not.toBeNull();
    expect(reloadedAuthState).not.toBeNull();
    expect(initialAuthState).toBe(reloadedAuthState);
  });
});
