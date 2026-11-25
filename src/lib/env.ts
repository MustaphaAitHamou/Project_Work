import "server-only";
import { z } from "zod";

/**
 * Server-side environment, validated once. Optional integrations (Stripe,
 * e-mail provider, registries, captcha) are reported as "not configured" by
 * the feature that needs them instead of failing the whole application.
 */
const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
  /**
   * Explicit application environment. Wins over VERCEL_ENV: the pre-production
   * Vercel project is "production" for Vercel but must behave as pre-production
   * (test payments, no indexing, demo data allowed).
   */
  APP_ENV: z.enum(["development", "preprod", "production"]).optional(),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  SUPABASE_SECRET_KEY: z.string().min(10),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_AUTOMATIC_TAX: bool,
  STRIPE_PRODUCT_NAME: z.string().default("Tamurt Jobs — annonce d'emploi (abonnement mensuel)"),

  EMAIL_PROVIDER: z.enum(["resend", "smtp", "none"]).default("none"),
  EMAIL_FROM: z.string().default("Tamurt Jobs <no-reply@localhost>"),
  EMAIL_REPLY_TO: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: bool,

  CRON_SECRET: z.string().min(16).optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),

  REGISTRY_FR_ENABLED: z.enum(["true", "false"]).default("true"),
  REGISTRY_VIES_ENABLED: z.enum(["true", "false"]).default("true"),
  COMPANIES_HOUSE_API_KEY: z.string().optional(),
  ZEFIX_USERNAME: z.string().optional(),
  ZEFIX_PASSWORD: z.string().optional(),
  OPENCORPORATES_API_TOKEN: z.string().optional(),
  REGISTRY_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** Tamurt Services (parent company) address: enables the red yaz button at the top right. Empty: no button. */
  TAMURT_SERVICES_URL: z.union([z.url(), z.literal("")]).optional(),
  /** Error monitoring (Sentry). Empty: nothing is loaded or sent. */
  NEXT_PUBLIC_SENTRY_DSN: z.union([z.url(), z.literal("")]).optional(),
  /**
   * Header that carries the visitor's IP, set by the reverse proxy in front of the app.
   * Vercel (default): first address of x-forwarded-for. Own server (Iglao, Nginx): x-real-ip,
   * which Nginx overwrites with the connecting address, so a visitor cannot forge it.
   */
  CLIENT_IP_HEADER: z.enum(["x-forwarded-for", "x-real-ip", "cf-connecting-ip", ""]).optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * Public settings only (site address, Supabase project URL and publishable key, environment).
 * They are enough to build the site: robots.txt, the sitemap and static pages are generated at
 * build time without any server secret, so the production build (GitHub Actions, for Iglao)
 * never needs one.
 */
const publicSchema = schema.pick({
  NODE_ENV: true,
  VERCEL_ENV: true,
  APP_ENV: true,
  NEXT_PUBLIC_SITE_URL: true,
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: true,
});
export type PublicEnv = z.infer<typeof publicSchema>;
let cachedPublic: PublicEnv | null = null;

export function publicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic;
  const parsed = publicSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cachedPublic = parsed.data;
  return cachedPublic;
}

export type AppEnv = "development" | "preprod" | "production";

/** Application environment: APP_ENV when set, otherwise derived from Vercel. */
export function appEnv(): AppEnv {
  const e = publicEnv();
  if (e.APP_ENV) return e.APP_ENV;
  if (e.VERCEL_ENV === "production") return "production";
  if (e.VERCEL_ENV === "preview") return "preprod";
  return "development";
}

export function isProductionDeployment(): boolean {
  return appEnv() === "production";
}

export function siteUrl(path = ""): string {
  return new URL(path, publicEnv().NEXT_PUBLIC_SITE_URL).toString();
}

/** Configuration health used by /api/health and the admin dashboard (never exposes secrets). */
export function integrationStatus() {
  const e = env();
  const stripeMode = e.STRIPE_SECRET_KEY?.startsWith("sk_live_")
    ? "live"
    : e.STRIPE_SECRET_KEY?.startsWith("sk_test_") || e.STRIPE_SECRET_KEY?.startsWith("rk_test_")
      ? "test"
      : e.STRIPE_SECRET_KEY
        ? "unknown"
        : "missing";
  const problems: string[] = [];
  if (isProductionDeployment()) {
    if (process.env.PREPROD_BASIC_AUTH) problems.push("preprod_basic_auth_in_production");
    if (stripeMode !== "live") problems.push("stripe_not_live");
    if (!e.STRIPE_WEBHOOK_SECRET) problems.push("stripe_webhook_secret_missing");
    if (e.EMAIL_PROVIDER === "none") problems.push("email_provider_missing");
    if (!e.CRON_SECRET) problems.push("cron_secret_missing");
    if (!e.TURNSTILE_SECRET_KEY) problems.push("captcha_not_configured");
    // Own server (Iglao): without it, every visitor would share the reverse proxy's address in rate limits.
    if (!process.env.VERCEL && !e.CLIENT_IP_HEADER) problems.push("client_ip_header_missing");
    if (!e.STRIPE_AUTOMATIC_TAX) problems.push("stripe_tax_disabled");
  }
  return {
    appEnv: appEnv(),
    stripe: { mode: stripeMode, webhook: Boolean(e.STRIPE_WEBHOOK_SECRET), automaticTax: e.STRIPE_AUTOMATIC_TAX },
    email: { provider: e.EMAIL_PROVIDER },
    captcha: Boolean(e.TURNSTILE_SECRET_KEY && e.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    monitoring: Boolean(e.NEXT_PUBLIC_SENTRY_DSN),
    registries: {
      fr_recherche_entreprises: e.REGISTRY_FR_ENABLED === "true",
      eu_vies: e.REGISTRY_VIES_ENABLED === "true",
      uk_companies_house: Boolean(e.COMPANIES_HOUSE_API_KEY),
      ch_zefix: Boolean(e.ZEFIX_USERNAME && e.ZEFIX_PASSWORD),
      opencorporates: Boolean(e.OPENCORPORATES_API_TOKEN),
    },
    problems,
  };
}
