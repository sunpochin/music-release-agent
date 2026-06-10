# CI/CD & E2E Testing Task Tracker

- `[x]` Set up Playwright E2E testing
  - `[x]` Install `@playwright/test` in the root
  - `[x]` Create `playwright.config.js` in the root
  - `[x]` Write E2E test file (`tests/e2e/dashboard.spec.js`)
  - `[x]` Add `test:e2e` script to root `package.json`
  - `[x]` Add Playwright steps to GitHub Actions workflow (`ci.yml`)
- `[x]` Structured Logging (Pino)
  - `[x]` Install `pino` and `pino-http`
  - `[x]` Add Express correlation ID middleware
  - `[x]` Replace console.log in server.js and key services with pino loggers
  - `[x]` Forward X-Request-ID in social client requests
- `[ ]` [Future] TypeScript/JSDoc type checking
- `[ ]` [Future] Webwright AI Test Generator integration
