import { DashboardNav, type DashboardNavItem } from "./dashboard-nav";

export function DashboardShell({ title, items, children }: { title: string; items: DashboardNavItem[]; children: React.ReactNode }) {
  return (
    <div className="container-page py-6 lg:py-10">
      {/* grid-cols-1 + min-w-0: on phones the tab bar scrolls inside itself instead of widening the page. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[248px_1fr] lg:gap-10">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="lg:rounded-2xl lg:border lg:bg-card lg:p-3 lg:shadow-sm">
            <p className="mb-2 hidden px-3 pt-1 text-xs font-semibold tracking-wide text-muted-foreground lg:block">{title}</p>
            <DashboardNav items={items} label={title} />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 lg:mb-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-extrabold sm:text-[1.75rem]">{title}</h1>
        {description && <p className="max-w-2xl text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
