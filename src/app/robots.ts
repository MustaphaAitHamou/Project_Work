import type { MetadataRoute } from "next";
import { locales } from "@/i18n/routing";
import { env, isProductionDeployment } from "@/lib/env";

const PRIVATE = ["candidate", "employer", "admin", "login", "signup", "forgot-password", "reset-password", "check-email", "welcome", "account-suspended"];

export default function robots(): MetadataRoute.Robots {
  const base = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  // Preview and development deployments must never be indexed.
  if (!isProductionDeployment()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", ...locales.flatMap((l) => PRIVATE.map((p) => `/${l}/${p}`)), "/*?*q="],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
