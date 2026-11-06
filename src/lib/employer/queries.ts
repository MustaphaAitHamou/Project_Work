import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getMyCompany = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data: member } = await supabase.from("company_members").select("company_id, role, job_title, phone, is_legal_representative").eq("user_id", userId).maybeSingle();
  if (!member) return null;
  const { data: company } = await supabase.from("companies").select("*").eq("id", member.company_id).single();
  if (!company) return null;
  return { company, member };
});

export type MyCompany = NonNullable<Awaited<ReturnType<typeof getMyCompany>>>;
