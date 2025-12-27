import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { loadConfig, ensureOutputDir } from "../../src/utils/config-loader.js";
import type { PlaywrightAuthConfig } from "../../src/types.js";

const TEST_CONFIG_DIR = path.join(process.cwd(), "tests/unit/.tmp");
const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, "test-config.json");

// Valid Firebase config for testing
const validFirebaseConfig: PlaywrightAuthConfig = {
  provider: "firebase",
  testUser: {
    uid: "test-user-uid",
    email: "test@example.com",
  },
  firebase: {
    serviceAccount: {
      type: "service_account",
      project_id: "test-project",
      private_key_id: "key-id",
      private_key: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
      client_email: "test@test-project.iam.gserviceaccount.com",
      client_id: "123456789",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/test",
    },
    clientConfig: {
      apiKey: "test-api-key",
      authDomain: "test-project.firebaseapp.com",
      projectId: "test-project",
    },
  },
};

// Valid Supabase config for testing
const validSupabaseConfig: PlaywrightAuthConfig = {
  provider: "supabase",
  testUser: {
    email: "test@example.com",
    password: "test-password",
  },
  supabase: {
    url: "https://test-project.supabase.co",
    anonKey: "test-anon-key",
  },
};

describe("config-loader", () => {
  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(TEST_CONFIG_DIR)) {
      fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
    if (fs.existsSync(TEST_CONFIG_DIR)) {
      fs.rmdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  describe("loadConfig", () => {
    it("should load valid Firebase config", () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(validFirebaseConfig));

      const config = loadConfig(TEST_CONFIG_PATH);

      expect(config.provider).toBe("firebase");
      expect(config.testUser.uid).toBe("test-user-uid");
      expect(config.firebase?.clientConfig.apiKey).toBe("test-api-key");
    });

    it("should load valid Supabase config", () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(validSupabaseConfig));

      const config = loadConfig(TEST_CONFIG_PATH);

      expect(config.provider).toBe("supabase");
      expect(config.testUser.email).toBe("test@example.com");
      expect(config.supabase?.url).toBe("https://test-project.supabase.co");
    });

    it("should throw error for non-existent file", () => {
      expect(() => loadConfig("/non/existent/path.json")).toThrow(
        "Configuration file not found"
      );
    });

    it("should throw error for invalid JSON", () => {
      fs.writeFileSync(TEST_CONFIG_PATH, "{ invalid json }");

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        "Failed to parse configuration file"
      );
    });

    it("should throw error for missing provider", () => {
      const config = { testUser: { uid: "test" } };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Configuration must specify "provider" field'
      );
    });

    it("should throw error for unknown provider", () => {
      const config = { provider: "unknown", testUser: { uid: "test" } };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        "Unknown provider: unknown"
      );
    });

    it("should throw error for missing testUser", () => {
      const config = { provider: "firebase" };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        'Configuration must specify "testUser" field'
      );
    });

    describe("Firebase validation", () => {
      it("should throw error for missing firebase config", () => {
        const config = {
          provider: "firebase",
          testUser: { uid: "test" },
        };
        fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

        expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
          'Firebase provider requires "firebase" configuration'
        );
      });

      it("should throw error for missing serviceAccount", () => {
        const config = {
          provider: "firebase",
          testUser: { uid: "test" },
          firebase: {
            clientConfig: {
              apiKey: "key",
              authDomain: "domain",
              projectId: "project",
            },
          },
        };
        fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

        expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
          'Firebase configuration requires "serviceAccount"'
        );
      });

      it("should throw error for missing clientConfig", () => {
        const config = {
          provider: "firebase",
          testUser: { uid: "test" },
          firebase: {
            serviceAccount: validFirebaseConfig.firebase?.serviceAccount,
          },
        };
        fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

        expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
          'Firebase configuration requires "clientConfig"'
        );
      });

      it("should throw error for missing testUser.uid", () => {
        const config = {
          provider: "firebase",
          testUser: { email: "test@example.com" },
          firebase: validFirebaseConfig.firebase,
        };
        fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

        expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
          'Firebase authentication requires "testUser.uid"'
        );
      });
    });

    describe("Supabase validation", () => {
      it("should throw error for missing supabase config", () => {
        const config = {
          provider: "supabase",
          testUser: { email: "test@example.com", password: "password" },
        };
        fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

        expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
          'Supabase provider requires "supabase" configuration'
        );
      });

      it("should throw error for missing supabase url", () => {
        const config = {
          provider: "supabase",
          testUser: { email: "test@example.com", password: "password" },
          supabase: {
            anonKey: "key",
          },
        };
        fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

        expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
          'Supabase configuration requires "url"'
        );
      });

      it("should throw error for missing testUser email/password", () => {
        const config = {
          provider: "supabase",
          testUser: { uid: "test" },
          supabase: {
            url: "https://test.supabase.co",
            anonKey: "key",
          },
        };
        fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

        expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
          'Supabase authentication requires "testUser.email" and "testUser.password"'
        );
      });
    });
  });

  describe("ensureOutputDir", () => {
    const TEST_OUTPUT_DIR = path.join(TEST_CONFIG_DIR, "output");

    afterEach(() => {
      if (fs.existsSync(TEST_OUTPUT_DIR)) {
        fs.rmdirSync(TEST_OUTPUT_DIR, { recursive: true });
      }
    });

    it("should create directory if it does not exist", () => {
      expect(fs.existsSync(TEST_OUTPUT_DIR)).toBe(false);

      ensureOutputDir(TEST_OUTPUT_DIR);

      expect(fs.existsSync(TEST_OUTPUT_DIR)).toBe(true);
    });

    it("should not throw if directory already exists", () => {
      fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });

      expect(() => ensureOutputDir(TEST_OUTPUT_DIR)).not.toThrow();
    });
  });
});
