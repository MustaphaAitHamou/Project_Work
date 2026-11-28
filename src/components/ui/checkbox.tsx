import * as React from "react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-[18px] shrink-0 cursor-pointer rounded-[5px] border-input accent-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}
