import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { describeNotification } from "@/lib/email/templates";
import { markNotificationsReadAction } from "@/lib/notifications/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * The latest notifications of the signed-in user (the same events as the e-mails: applications,
 * moderation, billing, launch offer…). Read with the user's own rights (RLS: own rows only).
 */
export async function NotificationsPanel() {
  const [supabase, locale, t, format] = await Promise.all([createClient(), getLocale(), getTranslations("notifications"), getFormatter()]);
  const { data } = await supabase.from("notifications").select("id, type, data, read_at, created_at").order("created_at", { ascending: false }).limit(8);
  const items = (data ?? [])
    .map((n) => ({ ...n, view: describeNotification(n.type, locale, (n.data ?? {}) as Record<string, unknown>) }))
    .filter((n) => n.view)
    .slice(0, 6);
  const unread = items.filter((n) => !n.read_at).length;
  const now = new Date();
  return (
    <Card data-testid="notifications">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-5 text-primary" aria-hidden />
          {t("title")}
          {unread > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{t("unread", { count: unread })}</span>}
        </CardTitle>
        {unread > 0 && (
          <form action={markNotificationsReadAction}>
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" variant="ghost" size="sm">
              {t("markAllRead")}
            </Button>
          </form>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-3 text-sm">
                <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-primary"}`} />
                <div className="min-w-0 flex-1">
                  <p className={n.read_at ? "text-muted-foreground" : "font-medium"}>
                    {!n.read_at && <span className="sr-only">{t("unreadLabel")} </span>}
                    {n.view!.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <time dateTime={n.created_at}>{format.relativeTime(new Date(n.created_at), now)}</time>
                    {n.view!.href && n.view!.action && (
                      <>
                        {" · "}
                        <a href={n.view!.href} className="font-medium text-primary hover:underline">
                          {n.view!.action}
                        </a>
                      </>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
