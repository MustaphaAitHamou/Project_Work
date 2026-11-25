import { adsenseClient } from "@/lib/ads/config";

/**
 * ads.txt (Authorized Digital Sellers) for Google AdSense, generated from the
 * publisher id. If Tamurt Jobs runs on a subdomain, the root domain must serve
 * this file or redirect to it (Google starts crawling at the root domain).
 */
export function GET() {
  const client = adsenseClient();
  if (!client) return new Response("Not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const publisher = client.replace(/^ca-/, "");
  return new Response(`google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
