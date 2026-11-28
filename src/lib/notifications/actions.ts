"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

/** Marks all the user's notifications as read (own rows only, RLS). */
export async function markNotificationsReadAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  const requested = String(formData.get("locale") ?? "");
  const locale = (routing.locales as readonly string[]).includes(requested) ? requested : routing.defaultLocale;
  revalidatePath(`/${locale}`, "layout");
}
