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
          "h-11 w-full cursor-pointer appearance-none rounded-lg ps-3.5 pe-9 text-[15px] border border-input/70 bg-card shadow-xs transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 hover:border-input focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20",
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
