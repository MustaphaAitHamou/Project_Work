import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

export function AuthCard({ title, description, children, footer }: { title: string; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="container-page flex justify-center py-12 sm:py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-4">
          <h1 className="text-xl font-semibold leading-tight">{title}</h1>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
        {footer && <div className="border-t px-5 py-4 text-center text-sm text-muted-foreground">{footer}</div>}
      </Card>
    </div>
  );
}
