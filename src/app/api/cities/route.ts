import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

/** City autocomplete (public reference data, cacheable). */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  const country = request.nextUrl.searchParams.get("country");
  if (q.trim().length < 2) return NextResponse.json({ items: [] });
  const { data, error } = await createPublicClient().rpc("search_cities", {
    p_query: q,
    p_country: country && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : undefined,
    p_limit: 10,
  } as never);
  if (error) return NextResponse.json({ items: [] }, { status: 500 });
  return NextResponse.json(
    { items: data ?? [] },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
