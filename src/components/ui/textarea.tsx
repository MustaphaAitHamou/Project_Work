import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-lg px-3.5 py-2.5 text-[15px] leading-relaxed border border-input/70 bg-card shadow-xs transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 hover:border-input focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}
