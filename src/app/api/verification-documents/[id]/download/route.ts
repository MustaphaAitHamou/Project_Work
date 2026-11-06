import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { signedDownloadUrl, VERIFICATION_BUCKET } from "@/lib/files/resume-storage";

/** Verification documents: administrators with companies.verify only (checked and logged in SQL). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize_verification_document", { p_document_id: id });
  if (error || !data) return NextResponse.json({ error: "forbidden" }, { status: error?.code === "42501" ? 403 : 404 });
  const info = data as { storage_path: string; filename: string };
  try {
    const url = await signedDownloadUrl(VERIFICATION_BUCKET, info.storage_path, info.filename, 60);
    return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch {
    return NextResponse.json({ error: "file_unavailable" }, { status: 404 });
  }
}
