import { defineConfig, devices } from "@playwright/test";
import { preprodAccess } from "./tests/preprod/access";

/**
 * Acceptance checks run against the DEPLOYED pre-production site (Vercel, protected by Vercel
 * Authentication). Reads the git-ignored preprod-access.local.txt and preprod-accounts.local.txt.
 *
 *   npx playwright test -c playwright.preprod.config.ts --trace off
 *
 * Never point it at the production site: the address must contain "preprod".
 */
const { url } = preprodAccess();
const proxyServer = process.env.HTTPS_PROXY ?? process.env.https_proxy;

export default defineConfig({
  testDir: "tests/preprod",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: url,
    locale: "fr-FR",
    trace: "off",
    ...(proxyServer ? { proxy: { server: proxyServer } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
