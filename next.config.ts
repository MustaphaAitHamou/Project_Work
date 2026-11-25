import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs/config";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseOrigin = new URL(supabaseUrl).origin;
const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
// Google AdSense and its certified consent platform (Privacy & messaging) are allowed only when
// a publisher id is configured. Ads are then shown or hidden from the back-office (ads.enabled).
const adsConfigured = /^ca-pub-\d{10,20}$/.test(process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() ?? "");
const ADS_SCRIPT = "https://*.googlesyndication.com https://*.google.com https://*.gstatic.com https://*.adtrafficquality.google https://*.doubleclick.net https://*.googletagservices.com https://*.googleadservices.com";
const ADS_FRAME = "https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.adtrafficquality.google https://*.googleadservices.com";
const ADS_CONNECT = "https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.adtrafficquality.google https://*.googleadservices.com https://*.gstatic.com";
const frameSources = [turnstileEnabled ? "https://challenges.cloudflare.com" : "", adsConfigured ? ADS_FRAME : ""].filter(Boolean).join(" ");
const isDev = process.env.NODE_ENV !== "production";
// Same rule as appEnv() in src/lib/env.ts, evaluated at build time: only the real
// production deployment may be indexed by search engines.
const appEnvAtBuild =
  process.env.APP_ENV ?? (process.env.VERCEL_ENV === "production" ? "production" : process.env.VERCEL_ENV === "preview" ? "preprod" : "development");
const indexable = appEnvAtBuild === "production";

// Content Security Policy. Next.js requires inline scripts for hydration unless a
// nonce-based policy is used (which forces dynamic rendering of every page).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${turnstileEnabled ? " https://challenges.cloudflare.com" : ""}${adsConfigured ? ` ${ADS_SCRIPT}` : ""}`,
  `style-src 'self' 'unsafe-inline'${adsConfigured ? " https://fonts.googleapis.com" : ""}`,
  // Ad creatives can come from any HTTPS host.
  `img-src 'self' data: blob: ${supabaseOrigin}${adsConfigured ? " https:" : ""}`,
  `font-src 'self' data:${adsConfigured ? " https://fonts.gstatic.com" : ""}`,
  `connect-src 'self' ${supabaseOrigin}${isDev ? " ws: wss:" : ""}${adsConfigured ? ` ${ADS_CONNECT}` : ""}`,
  `frame-src ${frameSources || "'none'"}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(indexable ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]),
];

const nextConfig: NextConfig = {
  // Cache Components are intentionally not enabled in V1: almost every page reads the
  // Supabase session cookie. See docs/ARCHITECTURE.md ("Rendering & caching").
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: supabaseOrigin.startsWith("https") ? "https" : "http",
        hostname: new URL(supabaseUrl).hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

const withIntl = withNextIntl(nextConfig);

// Error monitoring: wrapped only when a DSN is configured. Browser events go through the
// same-origin /monitoring tunnel, so the content security policy needs no third-party host.
// Source maps are uploaded only if SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT are set.
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(withIntl, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      tunnelRoute: "/monitoring",
      silent: true,
      telemetry: false,
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
    })
  : withIntl;
