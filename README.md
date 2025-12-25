# playwright-auth-injector

Skip authentication UI in Playwright E2E tests by injecting auth state directly into the browser.

## Features

- **Simple API**: Config file + one line to authenticate
- **UI Skip**: No login form interaction, faster tests
- **Secure**: No test-only endpoints, no production code changes

## Supported Providers

- [x] Firebase Authentication
- [ ] Supabase (Coming soon)
- [ ] AWS Amplify (Planned)
- [ ] Auth0 (Planned)

## Installation

```bash
npm install -D playwright-auth-injector
```

## Setup

### 1. Create config file

```typescript
// playwright-auth.config.ts
import { defineConfig } from 'playwright-auth-injector';

export default defineConfig({
  provider: 'firebase',
  firebase: {
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT!,
    apiKey: process.env.FIREBASE_API_KEY!,
    uid: process.env.TEST_USER_UID!,
  },
});
```

### 2. Create auth setup

```typescript
// e2e/tests/auth.setup.ts
import { test as setup } from '@playwright/test';
import { injectAuth } from 'playwright-auth-injector';

setup('authenticate', async ({ page }) => {
  await injectAuth(page);
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
```

### 3. Configure Playwright

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'authenticated',
      testMatch: /.*\.spec\.ts/,
      use: {
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
```

### 4. Write tests

```typescript
// e2e/tests/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test('access authenticated page', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT` | Service account JSON (single line) |
| `FIREBASE_API_KEY` | Firebase Web API Key |
| `TEST_USER_UID` | Test user's UID |

## API

### `injectAuth(page, options?)`

Inject authentication state into the browser.

```typescript
await injectAuth(page);

// With options
await injectAuth(page, {
  profile: 'admin',    // Profile name
  waitAfter: 3000,     // Wait time after injection (ms)
});
```

### `defineConfig(config)`

Type-safe config helper.

## License

MIT
