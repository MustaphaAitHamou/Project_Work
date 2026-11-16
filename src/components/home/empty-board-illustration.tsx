import { cn } from "@/lib/utils";

/**
 * Empty state for the latest offers: a job board with pinned blank cards and a clock
 * ("the first offers are coming soon"). Uses theme tokens, so it follows light and dark modes.
 */
export function EmptyBoardIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 170" aria-hidden className={cn("h-auto", className)}>
      <rect
        x="10"
        y="18"
        width="200"
        height="140"
        rx="6"
        fill="var(--secondary)"
        stroke="var(--border)"
        strokeWidth="2"
      />
      <path d="M10 40h200" stroke="var(--border)" strokeWidth="2" />
      <circle cx="26" cy="29" r="4" fill="var(--primary)" />
      <rect
        x="38"
        y="25"
        width="54"
        height="8"
        rx="2"
        fill="var(--primary)"
        fillOpacity="0.35"
      />

      {[
        { x: 26, y: 56, r: -4, pin: "#F8BA3C" },
        { x: 84, y: 60, r: 3, pin: "var(--primary)" },
        { x: 142, y: 54, r: -2, pin: "var(--primary)" },
      ].map((c) => (
        <g
          key={c.x}
          transform={`translate(${c.x} ${c.y}) rotate(${c.r} 26 40)`}
        >
          <rect
            width="52"
            height="80"
            rx="4"
            fill="var(--card)"
            stroke="var(--border)"
            strokeWidth="1.5"
          />
          <rect
            x="9"
            y="14"
            width="24"
            height="24"
            rx="3"
            fill="var(--secondary)"
          />
          <rect
            x="9"
            y="46"
            width="34"
            height="5"
            rx="2"
            fill="var(--muted-foreground)"
            fillOpacity="0.35"
          />
          <rect
            x="9"
            y="56"
            width="24"
            height="5"
            rx="2"
            fill="var(--muted-foreground)"
            fillOpacity="0.25"
          />
          <rect
            x="9"
            y="66"
            width="30"
            height="5"
            rx="2"
            fill="var(--muted-foreground)"
            fillOpacity="0.25"
          />
          <circle
            cx="26"
            cy="2"
            r="5"
            fill={c.pin}
            stroke="var(--card)"
            strokeWidth="2"
          />
        </g>
      ))}

      <g transform="translate(206 128)">
        <circle
          r="24"
          fill="var(--card)"
          stroke="var(--primary)"
          strokeWidth="3"
        />
        <path
          d="M0-13V0l9 6"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle r="2.5" fill="var(--primary)" />
      </g>
      <path
        transform="translate(226 22)"
        d="M0-9C1.6-1.6 1.6-1.6 9 0C1.6 1.6 1.6 1.6 0 9C-1.6 1.6-1.6 1.6-9 0C-1.6-1.6-1.6-1.6 0-9Z"
        fill="#F8BA3C"
      />
    </svg>
  );
}
