"use client";
import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { toggleSavedJobAction } from "@/app/[locale]/jobs/actions";

export function SaveJobButton({ jobId, initialSaved, loginHref }: { jobId: string; initialSaved: boolean; loginHref?: string }) {
  const t = useTranslations("job");
  const locale = useLocale();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, start] = useTransition();
  if (loginHref) {
    return (
      <Button asChild variant="outline" className="w-full">
        <Link href={loginHref}>
          <Bookmark aria-hidden />
          {t("save")}
        </Link>
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      className="w-full"
      aria-pressed={saved}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !saved;
          setSaved(next);
          const res = await toggleSavedJobAction(jobId, next, locale);
          if (!res.ok) {
            setSaved(!next);
            toast.error(res.message);
          } else toast.success(next ? t("savedToast") : t("unsavedToast"));
        })
      }
    >
      {saved ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
      {saved ? t("saved") : t("save")}
    </Button>
  );
}
