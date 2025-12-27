import { test as setup } from "@playwright/test";
import { authSetup } from "../../src/index.js";
import * as path from "path";
import * as fs from "fs";

const CONFIG_PATH = path.join(__dirname, "playwright.env.json");
const AUTH_DIR = path.join(__dirname, ".auth");

setup.skip(
  !fs.existsSync(CONFIG_PATH) ||
  JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")).provider !== "firebase",
  "Firebase config not found or provider is not firebase"
);

setup("Firebase authentication setup", async () => {
  console.log("[E2E] Starting Firebase authentication setup...");

  await authSetup({
    configPath: CONFIG_PATH,
    outputDir: AUTH_DIR,
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    storageStateFile: "user.json",
  });

  console.log("[E2E] Firebase authentication setup complete");
});
