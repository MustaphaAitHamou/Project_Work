import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[15px] font-semibold tracking-[-0.005em] transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 motion-reduce:active:translate-y-0 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm shadow-primary/25 inset-ring inset-ring-white/10 hover:bg-primary-hover hover:shadow-md hover:shadow-primary/25",
        /** Royal-blue outline on a transparent background, soft blue on hover. */
        secondary: "border-[1.5px] border-primary/80 text-primary hover:border-primary hover:bg-secondary",
        outline: "border border-input/60 bg-card shadow-xs hover:border-input hover:bg-muted",
        ghost: "hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline",
        /** On the night-blue brand surfaces: white fill, night-blue text. */
        inverse: "bg-brand-on text-brand-deep shadow-sm hover:bg-[#e9edfb]",
        /** Yellow call to action, on night blue only (launch offer). */
        highlight: "bg-highlight text-highlight-foreground shadow-sm hover:bg-[#f9d36e]",
      },
      size: {
        sm: "h-9 rounded-md px-3 text-sm",
        default: "h-11 px-5",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
