import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

/** Search-as-you-type suggestions (titles of open positions and skills). */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  if (q.trim().length < 2) return NextResponse.json({ items: [] });
  const { data } = await createPublicClient().rpc("search_suggestions", { p_prefix: q, p_limit: 8 });
  return NextResponse.json(
    { items: data ?? [] },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } },
  );
}
