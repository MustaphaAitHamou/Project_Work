import { readFileSync } from "node:fs";
import { test as base, type Page } from "@playwright/test";

/** Pre-production address and automation bypass, from the git-ignored access file. Never printed. */
export function preprodAccess(): { url: string; bypass: string; cronSecret: string } {
  const values = new Map<string, string>();
  for (const line of readFileSync("preprod-access.local.txt", "utf8").split("\n")) {
    const kv = line.match(/^([A-Z_]+)=(.*)$/);
    if (kv) values.set(kv[1], kv[2]);
    const url = line.match(/^URL : (https:\/\/\S+)$/);
    if (url) values.set("URL", url[1]);
  }
  const url = values.get("URL") ?? "";
  if (!/^https:\/\/[a-z0-9-]*preprod[a-z0-9.-]*$/.test(url)) throw new Error("preprod-access.local.txt: no pre-production address");
  return { url, bypass: values.get("VERCEL_AUTOMATION_BYPASS") ?? "", cronSecret: values.get("CRON_SECRET") ?? "" };
}

/** Acceptance accounts created by scripts/preprod-seed.mjs (email, password, role). */
export function preprodAccount(email: string): { email: string; password: string } {
  for (const line of readFileSync("preprod-accounts.local.txt", "utf8").split("\n")) {
    const [address, password] = line.split("\t");
    if (address === email && password) return { email, password };
  }
  throw new Error(`preprod-accounts.local.txt: no account ${email}`);
}

/** The bypass header is added only to requests for the pre-production host (never to third parties). */
export async function allowThroughVercelProtection(page: Page) {
  const { url, bypass } = preprodAccess();
  const host = new URL(url).host;
  await page.context().route(
    (u) => u.host === host,
    (route) => route.continue({ headers: { ...route.request().headers(), "x-vercel-protection-bypass": bypass } }),
  );
}

export const test = base.extend<{ preprod: Page }>({
  preprod: async ({ page }, provide) => {
    await allowThroughVercelProtection(page);
    await provide(page);
  },
});
export { expect } from "@playwright/test";
