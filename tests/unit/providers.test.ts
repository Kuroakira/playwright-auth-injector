import { describe, it, expect, vi, beforeEach } from "vitest";
import { FirebaseProvider } from "../../src/providers/firebase.js";
import { SupabaseProvider } from "../../src/providers/supabase.js";
import type { FirebaseConfig, SupabaseConfig, TestUser } from "../../src/types.js";

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

describe("FirebaseProvider", () => {
  const mockFirebaseConfig: FirebaseConfig = {
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
  };

  const mockTestUser: TestUser = {
    uid: "test-user-uid",
    email: "test@example.com",
  };

  it("should create instance with config", () => {
    const provider = new FirebaseProvider(mockFirebaseConfig, mockTestUser);
    expect(provider).toBeInstanceOf(FirebaseProvider);
  });

  it("should throw error if uid is missing", async () => {
    const provider = new FirebaseProvider(mockFirebaseConfig, { email: "test@example.com" });

    // Create a mock page
    const mockPage = {
      on: vi.fn(),
      goto: vi.fn(),
      addScriptTag: vi.fn(),
      evaluate: vi.fn(),
      waitForTimeout: vi.fn(),
      reload: vi.fn(),
    };

    await expect(provider.signIn(mockPage as never)).rejects.toThrow(
      "Firebase authentication requires testUser.uid to be set"
    );
  });
});

describe("SupabaseProvider", () => {
  const mockSupabaseConfig: SupabaseConfig = {
    url: "https://test-project.supabase.co",
    anonKey: "test-anon-key",
  };

  const mockTestUser: TestUser = {
    email: "test@example.com",
    password: "test-password",
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("should create instance with config", () => {
    const provider = new SupabaseProvider(mockSupabaseConfig, mockTestUser);
    expect(provider).toBeInstanceOf(SupabaseProvider);
  });

  it("should throw error if email is missing", async () => {
    const provider = new SupabaseProvider(mockSupabaseConfig, { password: "test" });

    const mockPage = {
      on: vi.fn(),
      goto: vi.fn(),
      evaluate: vi.fn(),
      reload: vi.fn(),
    };

    await expect(provider.signIn(mockPage as never)).rejects.toThrow(
      "Supabase authentication requires testUser.email and testUser.password"
    );
  });

  it("should throw error if password is missing", async () => {
    const provider = new SupabaseProvider(mockSupabaseConfig, { email: "test@example.com" });

    const mockPage = {
      on: vi.fn(),
      goto: vi.fn(),
      evaluate: vi.fn(),
      reload: vi.fn(),
    };

    await expect(provider.signIn(mockPage as never)).rejects.toThrow(
      "Supabase authentication requires testUser.email and testUser.password"
    );
  });

  it("should throw error on API failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue("Invalid credentials"),
    });

    const provider = new SupabaseProvider(mockSupabaseConfig, mockTestUser);

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

  it("should extract project ref from standard Supabase URL", () => {
    const provider = new SupabaseProvider(
      { url: "https://abcdefg.supabase.co", anonKey: "key" },
      mockTestUser
    );

    // Access private method via any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectRef = (provider as any).getProjectRef();
    expect(projectRef).toBe("abcdefg");
  });

  it("should handle custom domain URLs", () => {
    const provider = new SupabaseProvider(
      { url: "https://api.example.com", anonKey: "key" },
      mockTestUser
    );

    // Access private method via any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectRef = (provider as any).getProjectRef();
    expect(projectRef).toBe("api-example-com");
  });
});
