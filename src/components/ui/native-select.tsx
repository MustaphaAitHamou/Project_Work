import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Native <select> styled like the design system: accessible, form-friendly, works
 * without JS. `className` sizes the control (wrapper); `selectClassName` targets the
 * <select> element itself (e.g. height).
 */
export function NativeSelect({
  className,
  selectClassName,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { selectClassName?: string }) {
  return (
    <div className={cn("relative w-full", className)}>
      <select
        className={cn(
          "h-10 w-full appearance-none rounded-lg border border-input bg-background ps-3 pe-9 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
          selectClassName,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
