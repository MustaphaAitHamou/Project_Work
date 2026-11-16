import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { RESUME_BUCKET, signedDownloadUrl } from "@/lib/files/resume-storage";

/**
 * Original CV of an application, for its recruiters. Refused during the anonymous
 * phase: authorize_application_resume_download (run with the caller's JWT) only
 * answers once the candidate has accepted to disclose their identity, and logs the
 * download. The file is then served through a 60-second signed URL.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize_application_resume_download", { p_application_id: id });
  if (error || !data) return NextResponse.json({ error: "forbidden" }, { status: error?.code === "42501" ? 403 : 404, headers: { "Cache-Control": "no-store" } });
  const info = data as { storage_path: string; filename: string };
  try {
    const url = await signedDownloadUrl(RESUME_BUCKET, info.storage_path, info.filename, 60);
    return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (e) {
    console.error("resume file unavailable", id, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "file_unavailable" }, { status: 404 });
  }
}
