import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { SessionUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { TamurtYaz } from "./tamurt-yaz";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";
import { NavLink } from "./nav-link";

export async function SiteHeader({ user }: { user: SessionUser | null }) {
  const t = await getTranslations("nav");
  const links = [
    { href: "/", label: t("home"), exact: true },
    { href: "/jobs", label: t("searchJobs") },
    { href: "/companies", label: t("companies") },
    { href: "/cv", label: t("uploadCv") },
    { href: "/recruiters", label: t("recruiterSpace") },
  ];
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="shrink-0 rounded-md" aria-label={t("homeAria")}>
          <Logo />
        </Link>
        <nav aria-label={t("mainNav")} className="hidden flex-1 items-center gap-1 lg:flex">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href} exact={l.exact}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          {user ? (
            <UserMenu
              user={{
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                accountType: user.accountType,
                isAdmin: user.roles.length > 0,
              }}
            />
          ) : (
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/login">{t("login")}</Link>
            </Button>
          )}
          <MobileNav links={links} loggedIn={Boolean(user)} />
          <TamurtYaz />
        </div>
      </div>
    </header>
  );
}
