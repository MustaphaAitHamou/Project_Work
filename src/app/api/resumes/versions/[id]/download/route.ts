import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { RESUME_BUCKET, signedDownloadUrl } from "@/lib/files/resume-storage";

/**
 * CV download. Authorisation and access logging happen in the database
 * (authorize_resume_download, executed with the caller's JWT): the owner, or a
 * recruiter of the company that received an application with this exact
 * version. The file is then served through a 60-second signed URL.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize_resume_download", { p_version_id: id });
  if (error || !data) return NextResponse.json({ error: "forbidden" }, { status: error?.code === "42501" ? 403 : 404 });
  const info = data as { storage_path: string; filename: string };
  const url = await signedDownloadUrl(RESUME_BUCKET, info.storage_path, info.filename, 60);
  return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
