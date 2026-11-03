"use client";
import {
  Bell, BarChart3, Bookmark, Briefcase, Building2, CreditCard, FileText, Flag, Globe2, KeyRound, LayoutDashboard,
  Mail, ScrollText, Settings, Shield, ShieldCheck, Tags, User, Users, Wallet,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ICONS = {
  bell: Bell, chart: BarChart3, bookmark: Bookmark, briefcase: Briefcase, building: Building2, card: CreditCard,
  file: FileText, flag: Flag, globe: Globe2, key: KeyRound, dashboard: LayoutDashboard, mail: Mail, scroll: ScrollText,
  settings: Settings, shield: Shield, shieldCheck: ShieldCheck, tags: Tags, user: User, users: Users, wallet: Wallet,
} as const;

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  exact?: boolean;
  badge?: number;
}

export function DashboardNav({ items, label }: { items: DashboardNavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
                )}
              >
                <Icon className="size-4" aria-hidden />
                <span className="whitespace-nowrap">{item.label}</span>
                {item.badge ? (
                  <span className="ms-auto rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{item.badge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
