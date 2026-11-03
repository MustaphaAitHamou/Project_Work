import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";

/** Right of access / portability: JSON export of the caller's personal data (logged). */
export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 401 });
  if (!(await rateLimit(`export:${userId}`, 10, 3600))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const { data, error } = await supabase.rpc("export_my_data");
  if (error) return NextResponse.json({ error: "generic" }, { status: 500 });
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="tamurt-jobs-export-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
