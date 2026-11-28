"use client";
import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileNav({ links, loggedIn }: { links: { href: string; label: string }[]; loggedIn: boolean }) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("openMenu")}>
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent closeLabel={tc("close")}>
        <SheetTitle className="font-display text-lg font-bold">{t("menu")}</SheetTitle>
        <nav aria-label={t("mainNav")} className="flex flex-col gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-3.5 py-3 text-[15px] font-medium transition-colors hover:bg-muted">
              {l.label}
            </Link>
          ))}
          {!loggedIn && (
            <Button asChild className="mt-4">
              <Link href="/login" onClick={() => setOpen(false)}>
                {t("login")}
              </Link>
            </Button>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
