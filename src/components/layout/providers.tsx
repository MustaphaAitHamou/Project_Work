"use client";
import { ThemeProvider } from "next-themes";
import { Direction } from "radix-ui";
import { Toaster } from "sonner";

export function Providers({ children, dir }: { children: React.ReactNode; dir: "ltr" | "rtl" }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <Direction.Provider dir={dir}>
        {children}
        <Toaster position={dir === "rtl" ? "bottom-left" : "bottom-right"} richColors closeButton dir={dir} />
      </Direction.Provider>
    </ThemeProvider>
  );
}
