import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full min-w-0 rounded-lg px-3.5 py-2 text-[15px] border border-input/70 bg-card shadow-xs transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 hover:border-input focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20 file:me-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}
