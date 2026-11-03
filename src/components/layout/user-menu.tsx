"use client";
import { useTranslations } from "next-intl";
import { Briefcase, FileText, LayoutDashboard, LogOut, Settings, Shield, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { initials } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  user: { firstName: string; lastName: string; email: string; accountType: "candidate" | "employer"; isAdmin: boolean };
}

export function UserMenu({ user }: Props) {
  const t = useTranslations("nav");
  const items =
    user.accountType === "candidate"
      ? [
          { href: "/candidate", label: t("dashboard"), icon: LayoutDashboard },
          { href: "/candidate/profile", label: t("myProfile"), icon: User },
          { href: "/candidate/applications", label: t("myApplications"), icon: FileText },
          { href: "/candidate/settings", label: t("settings"), icon: Settings },
        ]
      : [
          { href: "/employer", label: t("recruiterDashboard"), icon: LayoutDashboard },
          { href: "/employer/jobs", label: t("myJobs"), icon: Briefcase },
          { href: "/employer/billing", label: t("billing"), icon: FileText },
          { href: "/employer/settings", label: t("settings"), icon: Settings },
        ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="ms-1 flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        aria-label={t("accountMenu")}
      >
        {initials(user.firstName, user.lastName)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-semibold text-foreground">
            {`${user.firstName} ${user.lastName}`.trim() || user.email}
          </span>
          <span className="block truncate">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>
              <item.icon aria-hidden />
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        {user.isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield aria-hidden />
              {t("admin")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <form action="/auth/signout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden />
              {t("logout")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
