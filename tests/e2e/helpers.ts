import { expect, type Page } from "@playwright/test";
import { MAILPIT_URL } from "../helpers/supabase";

/** Waits for the latest e-mail sent to `to` (local Mailpit) and returns the first link matching `pattern`. */
export async function linkFromEmail(to: string, pattern: RegExp, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const json = (await res.json()) as { messages?: { ID: string }[] };
    if (json.messages?.length) {
      const msg = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${json.messages[0].ID}`)).json()) as { HTML: string };
      const hrefs = [...msg.HTML.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
      const link = hrefs.find((h) => pattern.test(h));
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No e-mail with a link matching ${pattern} for ${to}`);
}

export async function emailSubjects(to: string): Promise<string[]> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
  const json = (await res.json()) as { messages?: { Subject: string }[] };
  return (json.messages ?? []).map((m) => m.Subject);
}

export async function signUpAndConfirm(page: Page, opts: { email: string; firstName: string; lastName: string; employer?: boolean }) {
  await page.goto(opts.employer ? "/fr/signup/employer" : "/fr/signup");
  await page.waitForLoadState("networkidle");
  await page.getByRole("textbox", { name: "Prénom", exact: true }).fill(opts.firstName);
  await page.getByRole("textbox", { name: "Nom", exact: true }).fill(opts.lastName);
  await page.getByRole("textbox", { name: opts.employer ? "E-mail professionnel" : "Adresse e-mail", exact: true }).fill(opts.email);
  await page.locator("input[name=password]").fill("Str0ngPassw0rd");
  await page.locator("input[name=passwordConfirm]").fill("Str0ngPassw0rd");
  await page.locator("input[name=terms]").check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/check-email/);
  const link = await linkFromEmail(opts.email, /auth\/confirm/);
  await page.goto(link);
}
