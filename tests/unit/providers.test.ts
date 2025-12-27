import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { FirebaseProvider } from "../../src/providers/firebase.js";
import { SupabaseProvider } from "../../src/providers/supabase.js";
import { createProviderFromConfigFile, ensureOutputDir } from "../../src/index.js";
import type { PlaywrightAuthConfig } from "../../src/types.js";

// Mock firebase-admin
vi.mock("firebase-admin", () => {
  const mockAuth = {
    createCustomToken: vi.fn().mockResolvedValue("mock-custom-token"),
  };

  return {
    default: {
      apps: [],
      initializeApp: vi.fn(),
      credential: {
        cert: vi.fn().mockReturnValue({}),
      },
      auth: vi.fn().mockReturnValue(mockAuth),
    },
  };
});

// Mock fetch for Supabase
const mockFetch = vi.fn();
global.fetch = mockFetch;

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

describe("Provider.fromConfigFile", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_CONFIG_DIR)) {
      fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
    if (fs.existsSync(TEST_CONFIG_DIR)) {
      fs.rmdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  describe("FirebaseProvider.fromConfigFile", () => {
    it("should create instance from valid config file", () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(validFirebaseConfig));

      const provider = FirebaseProvider.fromConfigFile(TEST_CONFIG_PATH);

      expect(provider).toBeInstanceOf(FirebaseProvider);
    });

    it("should throw error for non-existent file", () => {
      expect(() => FirebaseProvider.fromConfigFile("/non/existent/path.json")).toThrow(
        "Configuration file not found"
      );
    });

    it("should throw error for invalid JSON", () => {
      fs.writeFileSync(TEST_CONFIG_PATH, "{ invalid json }");

      expect(() => FirebaseProvider.fromConfigFile(TEST_CONFIG_PATH)).toThrow(
        "Failed to parse configuration file"
      );
    });

    it("should throw error for wrong provider type", () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(validSupabaseConfig));

      expect(() => FirebaseProvider.fromConfigFile(TEST_CONFIG_PATH)).toThrow(
        'Invalid provider: expected "firebase", got "supabase"'
      );
    });

    it("should throw error for missing firebase config", () => {
      const config = {
        provider: "firebase",
        testUser: { uid: "test" },
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => FirebaseProvider.fromConfigFile(TEST_CONFIG_PATH)).toThrow(
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

      expect(() => FirebaseProvider.fromConfigFile(TEST_CONFIG_PATH)).toThrow(
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

      expect(() => FirebaseProvider.fromConfigFile(TEST_CONFIG_PATH)).toThrow(
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

      expect(() => FirebaseProvider.fromConfigFile(TEST_CONFIG_PATH)).toThrow(
        'Firebase authentication requires "testUser.uid"'
      );
    });
  });

  describe("SupabaseProvider.fromConfigFile", () => {
    it("should create instance from valid config file", () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(validSupabaseConfig));

      const provider = SupabaseProvider.fromConfigFile(TEST_CONFIG_PATH);

      expect(provider).toBeInstanceOf(SupabaseProvider);
    });

    it("should throw error for non-existent file", () => {
      expect(() => SupabaseProvider.fromConfigFile("/non/existent/path.json")).toThrow(
        "Configuration file not found"
      );
    });

    it("should throw error for wrong provider type", () => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(validFirebaseConfig));

      expect(() => SupabaseProvider.fromConfigFile(TEST_CONFIG_PATH)).toThrow(
        'Invalid provider: expected "supabase", got "firebase"'
      );
    });

    it("should throw error for missing supabase config", () => {
      const config = {
        provider: "supabase",
        testUser: { email: "test@example.com", password: "password" },
      };
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

      expect(() => SupabaseProvider.fromConfigFile(TEST_CONFIG_PATH)).toThrow(
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

      expect(() => SupabaseProvider.fromConfigFile(TEST_CONFIG_PATH)).toThrow(
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

      expect(() => SupabaseProvider.fromConfigFile(TEST_CONFIG_PATH)).toThrow(
        'Supabase authentication requires "testUser.email" and "testUser.password"'
      );
    });
  });
});

describe("createProviderFromConfigFile", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_CONFIG_DIR)) {
      fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
    if (fs.existsSync(TEST_CONFIG_DIR)) {
      fs.rmdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  it("should create FirebaseProvider for firebase config", () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(validFirebaseConfig));

    const provider = createProviderFromConfigFile(TEST_CONFIG_PATH);

    expect(provider).toBeInstanceOf(FirebaseProvider);
  });

  it("should create SupabaseProvider for supabase config", () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(validSupabaseConfig));

    const provider = createProviderFromConfigFile(TEST_CONFIG_PATH);

    expect(provider).toBeInstanceOf(SupabaseProvider);
  });

  it("should throw error for non-existent file", () => {
    expect(() => createProviderFromConfigFile("/non/existent/path.json")).toThrow(
      "Configuration file not found"
    );
  });

  it("should throw error for invalid JSON", () => {
    fs.writeFileSync(TEST_CONFIG_PATH, "{ invalid json }");

    expect(() => createProviderFromConfigFile(TEST_CONFIG_PATH)).toThrow(
      "Failed to parse configuration file"
    );
  });

  it("should throw error for missing provider", () => {
    const config = { testUser: { uid: "test" } };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

    expect(() => createProviderFromConfigFile(TEST_CONFIG_PATH)).toThrow(
      'Configuration must specify "provider" field'
    );
  });

  it("should throw error for unknown provider", () => {
    const config = { provider: "unknown", testUser: { uid: "test" } };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));

    expect(() => createProviderFromConfigFile(TEST_CONFIG_PATH)).toThrow(
      "Unknown provider: unknown"
    );
  });
});

describe("ensureOutputDir", () => {
  const TEST_OUTPUT_DIR = path.join(TEST_CONFIG_DIR, "output");

  beforeEach(() => {
    if (!fs.existsSync(TEST_CONFIG_DIR)) {
      fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }
    if (fs.existsSync(TEST_CONFIG_DIR)) {
      fs.rmdirSync(TEST_CONFIG_DIR, { recursive: true });
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

describe("Provider signIn behavior", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    if (!fs.existsSync(TEST_CONFIG_DIR)) {
      fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
    if (fs.existsSync(TEST_CONFIG_DIR)) {
      fs.rmdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  it("FirebaseProvider should throw error if uid is missing in testUser", async () => {
    // Config with missing uid
    const configWithoutUid = {
      ...validFirebaseConfig,
      testUser: { email: "test@example.com" },
    };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(configWithoutUid));

    expect(() => FirebaseProvider.fromConfigFile(TEST_CONFIG_PATH)).toThrow(
      'Firebase authentication requires "testUser.uid"'
    );
  });

  it("SupabaseProvider should throw error on API failure", async () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(validSupabaseConfig));
    const provider = SupabaseProvider.fromConfigFile(TEST_CONFIG_PATH);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue("Invalid credentials"),
    });

    const mockPage = {
      on: vi.fn(),
      goto: vi.fn(),
      evaluate: vi.fn(),
      reload: vi.fn(),
    };

    await expect(provider.signIn(mockPage as never)).rejects.toThrow(
      "Supabase authentication failed: 401"
    );
  });
});
