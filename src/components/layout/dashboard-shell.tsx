import { DashboardNav, type DashboardNavItem } from "./dashboard-nav";

export function DashboardShell({ title, items, children }: { title: string; items: DashboardNavItem[]; children: React.ReactNode }) {
  return (
    <div className="container-page py-6 lg:py-10">
      <div className="grid gap-6 lg:grid-cols-[230px_1fr] lg:gap-10">
        <aside>
          <p className="mb-3 hidden text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:block">{title}</p>
          <DashboardNav items={items} label={title} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
