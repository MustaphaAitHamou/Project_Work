import type { MetadataRoute } from "next";
import { locales } from "@/i18n/routing";
import { isProductionDeployment, publicEnv } from "@/lib/env";

const PRIVATE = ["candidate", "employer", "admin", "login", "signup", "forgot-password", "reset-password", "check-email", "welcome", "account-suspended"];

export default function robots(): MetadataRoute.Robots {
  const base = publicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  // Preview and development deployments must never be indexed.
  if (!isProductionDeployment()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", ...locales.flatMap((l) => PRIVATE.map((p) => `/${l}/${p}`)), "/*?*q="],
      },
      // Google AdSense's crawler reads the public pages that carry an ad slot (search results
      // included) to choose relevant ads; it does not index anything. Private spaces have no ads.
      { userAgent: "Mediapartners-Google", allow: "/", disallow: ["/api/", "/auth/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
