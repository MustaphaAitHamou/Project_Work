import { expect, test, type Page } from "@playwright/test";
import { createTestUser, resetRateLimits, uniqueEmail } from "../helpers/supabase";
import { linkFromEmail, openConfirmationLink } from "./helpers";

test.beforeEach(async () => {
  await resetRateLimits();
});

test("a signed-in user can sign out from the account menu", async ({ page }) => {
  const user = await createTestUser("candidate", { firstName: "Leo", lastName: "Sortie" });
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(user.email);
  await page.locator("input[name=password]").fill(user.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));

  await page.getByRole("button", { name: /Menu du compte/ }).click();
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/fr$/);
  await expect(page.getByRole("link", { name: "Connexion" }).first()).toBeVisible();

  // The session is really gone: private pages redirect to the login page.
  await page.goto("/fr/candidate");
  await expect(page).toHaveURL(/\/fr\/login/);
});

test("the check-email page moves on by itself once the link is opened in another tab", async ({ page, context }) => {
  const email = uniqueEmail("e2e.onglet");
  await page.goto("/fr/signup");
  await page.waitForLoadState("networkidle");
  await page.getByRole("textbox", { name: "Prénom", exact: true }).fill("Nora");
  await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Onglet");
  await page.getByRole("textbox", { name: "Adresse e-mail", exact: true }).fill(email);
  await page.locator("input[name=password]").fill("Str0ngPassw0rd");
  await page.locator("input[name=passwordConfirm]").fill("Str0ngPassw0rd");
  await page.locator("input[name=terms]").check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/check-email/);

  const link = await linkFromEmail(email, /auth\/confirm/);
  const mailTab = await context.newPage();
  await openConfirmationLink(mailTab, link);
  await expect(mailTab).toHaveURL(/\/fr\/candidate/);

  // The first tab notices the session without any action from the user.
  await expect(page).toHaveURL(/\/fr\/candidate/, { timeout: 15_000 });
});

test.describe("Sign-up checks", () => {
  async function fill(page: Page, email: string, password: string, confirm: string, opts: { submit?: boolean } = {}) {
    await page.goto("/fr/signup");
    await page.waitForLoadState("networkidle");
    await page.getByRole("textbox", { name: "Prénom", exact: true }).fill("Test");
    await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Inscription");
    await page.getByRole("textbox", { name: "Adresse e-mail", exact: true }).fill(email);
    await page.locator("input[name=password]").fill(password);
    await page.locator("input[name=passwordConfirm]").fill(confirm);
    await page.locator("input[name=terms]").check();
    if (opts.submit !== false) await page.getByRole("button", { name: "Créer mon compte" }).click();
  }
  // The form's own alert (Next.js also renders a route announcer with role="alert").
  const alert = (page: Page) => page.locator("form").getByRole("alert");

  test("passwords must match", async ({ page }) => {
    await fill(page, uniqueEmail("e2e.mismatch"), "Str0ngPassw0rd", "Str0ngPassw0rX");
    await expect(alert(page)).toContainText("Les deux mots de passe ne correspondent pas.");
    await expect(page.locator("#passwordConfirm-error")).toHaveText("Les deux mots de passe ne correspondent pas.");
    await expect(page).toHaveURL(/\/fr\/signup/);
  });

  test("empty required fields are listed, the first one gets the focus", async ({ page }) => {
    await page.goto("/fr/signup");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(alert(page)).toContainText("Veuillez renseigner tous les champs obligatoires.");
    await expect(page.locator("#firstName-error")).toHaveText("Ce champ est obligatoire.");
    await expect(page.locator("#email-error")).toHaveText("Ce champ est obligatoire.");
    await expect(page.getByText("Vous devez accepter les conditions pour continuer.")).toBeVisible();
    await expect(page.locator("#firstName")).toBeFocused();
    await expect(page.locator("#firstName")).toHaveAttribute("aria-invalid", "true");
  });

  test("an invalid address and a weak password are explained under their field, and the input is kept", async ({ page }) => {
    await fill(page, "amina@", "Str0ngPassw0rd", "Str0ngPassw0rd");
    await expect(alert(page)).toContainText("Veuillez saisir une adresse e-mail valide.");
    await expect(page.locator("#email-error")).toHaveText("Veuillez saisir une adresse e-mail valide.");
    await expect(page.locator("#email")).toBeFocused();
    await expect(page.getByRole("textbox", { name: "Prénom", exact: true })).toHaveValue("Test");

    await fill(page, uniqueEmail("e2e.weak"), "abcdefghij", "abcdefghij");
    await expect(alert(page)).toContainText("Votre mot de passe ne respecte pas les critères de sécurité indiqués.");
    await expect(page.locator("#password-error")).toHaveText("Votre mot de passe ne respecte pas les critères de sécurité indiqués.");
  });

  test("an address on a domain that cannot receive e-mail is refused", async ({ page }) => {
    await fill(page, "erzfgujeifgu@gergfe.invalid", "Str0ngPassw0rd", "Str0ngPassw0rd");
    await expect(page.locator("#email-error")).toHaveText("Ce domaine n'existe pas ou ne reçoit pas d'e-mails. Vérifiez l'adresse.");
  });

  test("an address that already has an account gets a clear message with the next steps", async ({ page }) => {
    const existing = await createTestUser("candidate");
    await fill(page, existing.email, "Str0ngPassw0rd", "Str0ngPassw0rd");
    await expect(alert(page)).toContainText(
      "Cette adresse e-mail est peut-être déjà associée à un compte. Essayez de vous connecter ou de réinitialiser votre mot de passe.",
    );
    await expect(page.locator("#email-error")).toHaveText("Cette adresse est peut-être déjà associée à un compte.");
    await expect(alert(page).getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/fr/login");
    await expect(alert(page).getByRole("link", { name: "Réinitialiser mon mot de passe" })).toHaveAttribute("href", "/fr/forgot-password");
    await expect(page).toHaveURL(/\/fr\/signup/);
    await expect(page.getByRole("textbox", { name: "Adresse e-mail", exact: true })).toHaveValue(existing.email);
  });

  test("too many attempts for one address are stopped", async ({ page }) => {
    const existing = await createTestUser("candidate");
    for (let i = 0; i < 5; i++) {
      await fill(page, existing.email, "Str0ngPassw0rd", "Str0ngPassw0rd");
      await expect(alert(page)).toContainText("peut-être déjà associée");
    }
    await fill(page, existing.email, "Str0ngPassw0rd", "Str0ngPassw0rd");
    await expect(alert(page)).toContainText("Trop de tentatives ont été effectuées. Veuillez réessayer plus tard.");
  });

  test("offline: the visitor is told to check the connection and keeps what was typed", async ({ page, context }) => {
    await fill(page, uniqueEmail("e2e.offline"), "Str0ngPassw0rd", "Str0ngPassw0rd", { submit: false });
    await context.setOffline(true);
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(alert(page)).toContainText("Impossible de contacter le serveur. Vérifiez votre connexion Internet.");
    await expect(page.getByRole("textbox", { name: "Nom", exact: true })).toHaveValue("Inscription");
    await context.setOffline(false);
  });

  test("a server failure shows a neutral technical message, without details", async ({ page }) => {
    await fill(page, uniqueEmail("e2e.server"), "Str0ngPassw0rd", "Str0ngPassw0rd", { submit: false });
    await page.route("**/fr/signup", (route) =>
      route.request().method() === "POST" ? route.fulfill({ status: 500, contentType: "text/plain", body: "boom" }) : route.continue(),
    );
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(alert(page)).toContainText("Une erreur technique est survenue. Veuillez réessayer ultérieurement.");
    await expect(alert(page)).not.toContainText("boom");
    await expect(page.getByRole("textbox", { name: "Prénom", exact: true })).toHaveValue("Test");
  });

  test("a new address leads to the e-mail check, and the link confirms the account", async ({ page }) => {
    const email = uniqueEmail("e2e.new");
    await fill(page, email, "Str0ngPassw0rd", "Str0ngPassw0rd");
    await expect(page).toHaveURL(/check-email/);
    const link = await linkFromEmail(email, /auth\/confirm/);
    // A mail filter opens the link first (as Outlook Safe Links does): the token is not used up.
    const scanner = await page.request.get(link, { maxRedirects: 0 });
    expect(scanner.status()).toBe(307);
    expect(scanner.headers()["location"]).toMatch(/^\/fr\/confirm\?token_hash=/);
    await page.request.get(link);
    await openConfirmationLink(page, link);
    await expect(page).toHaveURL(/\/fr\/candidate/);
    // The same link a second time, still signed in: back to the person's space (the account is active).
    await openConfirmationLink(page, link);
    await expect(page).toHaveURL(/\/fr\/candidate/);
    // The same link on another device (signed out): clearly expired, never a technical error.
    const elsewhere = await page.context().browser()!.newContext({ locale: "fr-FR" });
    const other = await elsewhere.newPage();
    await openConfirmationLink(other, link);
    await expect(other).toHaveURL(/\/fr\/login\?error=link_invalid/);
    await expect(other.getByText("Ce lien est invalide ou a expiré.")).toBeVisible();
    await elsewhere.close();
  });
});

test("a signed-in user is never sent to the sign-up page", async ({ page }) => {
  const user = await createTestUser("candidate", { firstName: "Ines", lastName: "Connectee" });
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(user.email);
  await page.locator("input[name=password]").fill(user.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  await page.goto("/fr");
  await expect(page.getByRole("link", { name: "Créer mon profil gratuitement" })).toHaveCount(0);
  await page.goto("/fr/signup");
  await expect(page).toHaveURL(/\/fr\/candidate$/);
  await page.goto("/fr/signup/employer");
  await expect(page).toHaveURL(/\/fr\/candidate$/);
});
