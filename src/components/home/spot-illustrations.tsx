import { cn } from "@/lib/utils";

/**
 * Small "spot" illustrations for the home page sections (original artwork, Tamurt Services art direction).
 * They use theme tokens (--card, --border, --secondary, --primary, --success...), so they follow
 * light and dark modes. Decorative only: the text next to them carries the meaning.
 */
const GOLD = "#F6C445";
const LINE = "var(--muted-foreground)";

function Sparkle({
  x,
  y,
  s,
  color = GOLD,
}: {
  x: number;
  y: number;
  s: number;
  color?: string;
}) {
  return (
    <path
      transform={`translate(${x} ${y})`}
      d={`M0 ${-s}C${s * 0.18} ${-s * 0.18} ${s * 0.18} ${-s * 0.18} ${s} 0C${s * 0.18} ${s * 0.18} ${s * 0.18} ${s * 0.18} 0 ${s}C${-s * 0.18} ${s * 0.18} ${-s * 0.18} ${s * 0.18} ${-s} 0C${-s * 0.18} ${-s * 0.18} ${-s * 0.18} ${-s * 0.18} 0 ${-s}Z`}
      fill={color}
    />
  );
}

function Check({ d, width = 3 }: { d: string; width?: number }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="#FFFFFF"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** Verified recruiters: two office buildings and a shield with a check. */
export function VerifiedSpot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" aria-hidden className={cn("h-auto", className)}>
      <rect x="22" y="118" width="160" height="4" rx="2" fill="var(--border)" />
      <rect
        x="58"
        y="34"
        width="74"
        height="86"
        rx="4"
        fill="var(--card)"
        stroke="var(--border)"
        strokeWidth="2"
      />
      <rect x="58" y="34" width="74" height="15" rx="4" fill="var(--primary)" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={70 + c * 19}
            y={58 + r * 15}
            width="12"
            height="9"
            rx="1.5"
            fill="var(--primary)"
            fillOpacity="0.28"
          />
        )),
      )}
      <rect
        x="86"
        y="100"
        width="18"
        height="20"
        rx="2"
        fill="var(--primary)"
        fillOpacity="0.55"
      />
      <rect
        x="132"
        y="66"
        width="36"
        height="54"
        rx="4"
        fill="var(--card)"
        stroke="var(--border)"
        strokeWidth="2"
      />
      {[0, 1, 2].map((r) => (
        <rect
          key={r}
          x="142"
          y={76 + r * 13}
          width="16"
          height="7"
          rx="1.5"
          fill="var(--primary)"
          fillOpacity="0.28"
        />
      ))}
      <g transform="translate(50 84)">
        <path
          d="M0-28 22-19V0C22 14 11 23 0 28-11 23-22 14-22 0V-19Z"
          fill="var(--success)"
          stroke="var(--card)"
          strokeWidth="3"
        />
        <Check d="M-9 0l6 6 12-13" width={3.6} />
      </g>
      <Sparkle x={160} y={36} s={8} />
      <Sparkle x={178} y={56} s={4.5} color="var(--primary)" />
    </svg>
  );
}

/** Apply in one click: a profile card, a big apply button and a cursor clicking it. */
export function OneClickSpot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" aria-hidden className={cn("h-auto", className)}>
      <rect
        x="18"
        y="16"
        width="100"
        height="62"
        rx="4"
        fill="var(--card)"
        stroke="var(--border)"
        strokeWidth="2"
      />
      <circle cx="40" cy="38" r="12" fill="var(--secondary)" />
      <path
        d="M40 30.5 42.2 35.2 47.3 35.8 43.5 39.2 44.5 44.3 40 41.7 35.5 44.3 36.5 39.2 32.7 35.8 37.8 35.2Z"
        fill={GOLD}
      />
      <rect
        x="58"
        y="30"
        width="48"
        height="7"
        rx="2"
        fill="var(--foreground)"
        fillOpacity="0.8"
      />
      <rect
        x="58"
        y="42"
        width="32"
        height="5"
        rx="2"
        fill={LINE}
        fillOpacity="0.4"
      />
      <rect
        x="30"
        y="60"
        width="76"
        height="6"
        rx="3"
        fill="var(--secondary)"
      />
      <rect x="30" y="60" width="52" height="6" rx="3" fill="var(--primary)" />
      <path
        d="M118 46c26 0 40 10 44 30"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.4"
        strokeDasharray="2 7"
        strokeLinecap="round"
        className="tj-dash"
      />
      <rect
        x="66"
        y="86"
        width="112"
        height="36"
        rx="4"
        fill="var(--primary)"
      />
      <circle cx="86" cy="104" r="9" fill="var(--primary-foreground)" />
      <path
        d="M81.5 104.5l3 3 6-6.5"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="102"
        y="99"
        width="56"
        height="9"
        rx="2"
        fill="var(--primary-foreground)"
        fillOpacity="0.9"
      />
      <g transform="translate(152 108)">
        <path
          d="M-7-7l-6-6M2-10v-8M-10 2h-8"
          stroke={GOLD}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M0 0v26l7-6.7 4.8 11.2 5.2-2.2-4.8-11H22Z"
          fill="#FFFFFF"
          stroke="#0D1430"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** Equal opportunity: an anonymous profile, with "no photo" in the place of a portrait. */
export function EqualitySpot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" aria-hidden className={cn("h-auto", className)}>
      <rect
        x="30"
        y="20"
        width="132"
        height="104"
        rx="4"
        fill="var(--card)"
        stroke="var(--border)"
        strokeWidth="2"
      />
      <rect
        x="44"
        y="34"
        width="40"
        height="46"
        rx="3"
        fill="var(--secondary)"
        stroke="var(--primary)"
        strokeOpacity="0.55"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      <g
        transform="translate(64 57)"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="-11" y="-7" width="22" height="15" rx="3" />
        <circle r="4" cy="0.5" />
        <path d="M-4-7l2-3h4l2 3" />
        <path d="M-14 12 14-12" />
      </g>
      <rect
        x="96"
        y="38"
        width="52"
        height="7"
        rx="2"
        fill="var(--foreground)"
        fillOpacity="0.8"
      />
      <rect
        x="96"
        y="50"
        width="36"
        height="5"
        rx="2"
        fill={LINE}
        fillOpacity="0.4"
      />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x="44"
            y={92 + i * 9}
            width="104"
            height="5"
            rx="2.5"
            fill="var(--secondary)"
          />
          <rect
            x="44"
            y={92 + i * 9}
            width={[86, 64, 96][i]}
            height="5"
            rx="2.5"
            fill="var(--primary)"
          />
        </g>
      ))}
      <g transform="translate(162 22)">
        <circle r="17" fill={GOLD} stroke="var(--card)" strokeWidth="3" />
        <g
          fill="none"
          stroke="#5A3A00"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M0-9V8M-6 8h12M-10-5h20" />
          <path d="M-10-5-14 3h8ZM10-5 6 3h8Z" />
        </g>
      </g>
    </svg>
  );
}

/** Step 1: a profile being filled in. */
export function ProfileSpot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" aria-hidden className={cn("h-auto", className)}>
      <rect
        x="36"
        y="14"
        width="128"
        height="112"
        rx="4"
        fill="var(--card)"
        stroke="var(--border)"
        strokeWidth="2"
      />
      <circle cx="62" cy="40" r="14" fill="var(--secondary)" />
      <path
        d="M62 31.5 64.6 36.8 70.4 37.5 66.1 41.4 67.3 47.1 62 44.2 56.7 47.1 57.9 41.4 53.6 37.5 59.4 36.8Z"
        fill={GOLD}
      />
      <rect
        x="84"
        y="32"
        width="58"
        height="8"
        rx="2"
        fill="var(--foreground)"
        fillOpacity="0.8"
      />
      <rect
        x="84"
        y="45"
        width="40"
        height="5"
        rx="2"
        fill={LINE}
        fillOpacity="0.4"
      />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x="50"
            y={64 + i * 20}
            width="30"
            height="4"
            rx="2"
            fill={LINE}
            fillOpacity="0.45"
          />
          <rect
            x="50"
            y={71 + i * 20}
            width="100"
            height="9"
            rx="2"
            fill="var(--background)"
            stroke="var(--border)"
            strokeWidth="1.5"
          />
          {i < 2 ? (
            <rect
              x="54"
              y={74 + i * 20}
              width={[58, 74][i]}
              height="3"
              rx="1.5"
              fill="var(--primary)"
            />
          ) : null}
        </g>
      ))}
      <g transform="translate(128 112) rotate(-40)">
        <rect
          x="-4"
          y="-34"
          width="8"
          height="30"
          rx="1.5"
          fill="var(--primary)"
        />
        <rect x="-4" y="-38" width="8" height="6" rx="1.5" fill={GOLD} />
        <path d="M-4-4h8L0 4Z" fill="var(--foreground)" />
      </g>
      <Sparkle x={168} y={22} s={7} />
    </svg>
  );
}

/** Step 2: a CV uploaded and kept private (padlock). */
export function UploadSpot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" aria-hidden className={cn("h-auto", className)}>
      <path
        d="M62 22h52l22 22v78a4 4 0 0 1-4 4H62a4 4 0 0 1-4-4V26a4 4 0 0 1 4-4Z"
        fill="var(--card)"
        stroke="var(--border)"
        strokeWidth="2"
      />
      <path
        d="M114 22v18a4 4 0 0 0 4 4h18"
        fill="var(--secondary)"
        stroke="var(--border)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect
        x="70"
        y="56"
        width="40"
        height="7"
        rx="2"
        fill="var(--foreground)"
        fillOpacity="0.8"
      />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x="70"
          y={72 + i * 11}
          width={[56, 48, 54, 36][i]}
          height="5"
          rx="2"
          fill={LINE}
          fillOpacity="0.38"
        />
      ))}
      <g transform="translate(40 52)">
        <circle r="20" fill="var(--primary)" />
        <path
          d="M0 9V-8M-7-1l7-7 7 7"
          fill="none"
          stroke="var(--primary-foreground)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g transform="translate(140 108)">
        <circle
          r="19"
          fill="var(--success)"
          stroke="var(--card)"
          strokeWidth="3"
        />
        <rect x="-8" y="-3" width="16" height="12" rx="2" fill="#FFFFFF" />
        <path
          d="M-5-3v-4a5 5 0 0 1 10 0v4"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.6"
        />
      </g>
      <Sparkle x={160} y={30} s={7} />
    </svg>
  );
}

/** Step 3: the application flies straight to the recruiter. */
export function SendSpot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" aria-hidden className={cn("h-auto", className)}>
      <rect
        x="18"
        y="58"
        width="54"
        height="66"
        rx="4"
        fill="var(--card)"
        stroke="var(--border)"
        strokeWidth="2"
      />
      <circle cx="34" cy="76" r="8" fill="var(--secondary)" />
      <rect
        x="46"
        y="72"
        width="18"
        height="5"
        rx="2"
        fill="var(--foreground)"
        fillOpacity="0.8"
      />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x="28"
          y={92 + i * 9}
          width={[34, 26, 30][i]}
          height="4"
          rx="2"
          fill={LINE}
          fillOpacity="0.4"
        />
      ))}
      <path
        d="M62 52C80 18 120 14 146 40"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.4"
        strokeDasharray="2 7"
        strokeLinecap="round"
        className="tj-dash"
      />
      <g transform="translate(104 24) rotate(12)">
        <path d="M-16 0 18-12 6 16 1 4Z" fill="var(--primary)" />
        <path d="M1 4 18-12-6 2Z" fill="var(--primary)" fillOpacity="0.55" />
      </g>
      <rect
        x="128"
        y="58"
        width="56"
        height="50"
        rx="4"
        fill="var(--primary)"
      />
      <path
        d="M146 68v-4a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="3"
      />
      <rect
        x="138"
        y="68"
        width="36"
        height="28"
        rx="3"
        fill="var(--primary-foreground)"
      />
      <path d="M138 80h36" stroke="var(--primary)" strokeWidth="2" />
      <g transform="translate(184 58)">
        <circle
          r="14"
          fill="var(--success)"
          stroke="var(--card)"
          strokeWidth="3"
        />
        <Check d="M-6 0l4 4 8-9" />
      </g>
      <Sparkle x={34} y={30} s={7} />
    </svg>
  );
}

/** Recruiters: the applications dashboard, with a verified company badge. */
export function DashboardSpot({ className }: { className?: string }) {
  const rows = [
    { w: 92, chip: "var(--success)", chipW: 46 },
    { w: 70, chip: "var(--primary)", chipW: 54 },
    { w: 104, chip: GOLD, chipW: 40 },
    { w: 80, chip: "var(--primary)", chipW: 54 },
  ];
  return (
    <svg viewBox="0 0 320 230" aria-hidden className={cn("h-auto", className)}>
      <rect
        x="10"
        y="12"
        width="300"
        height="206"
        rx="6"
        fill="var(--card)"
        stroke="var(--border)"
        strokeWidth="2"
      />
      <path
        d="M10 18a6 6 0 0 1 6-6h288a6 6 0 0 1 6 6v18H10Z"
        fill="var(--secondary)"
      />
      {[24, 36, 48].map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy="24"
          r="4"
          fill={i === 0 ? "var(--primary)" : LINE}
          fillOpacity={i === 0 ? 0.85 : 0.35}
        />
      ))}
      <rect
        x="10"
        y="36"
        width="70"
        height="182"
        fill="var(--secondary)"
        fillOpacity="0.55"
      />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x="22"
          y={56 + i * 22}
          width={i === 0 ? 46 : 38}
          height="8"
          rx="2"
          fill={i === 0 ? "var(--primary)" : LINE}
          fillOpacity={i === 0 ? 1 : 0.35}
        />
      ))}
      <rect x="96" y="50" width="30" height="30" rx="4" fill="var(--primary)" />
      <path
        d="M104 61v-2.5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2V61"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="2"
      />
      <rect
        x="102"
        y="61"
        width="18"
        height="12"
        rx="2"
        fill="var(--primary-foreground)"
      />
      <g transform="translate(126 50)">
        <circle
          r="9"
          fill="var(--success)"
          stroke="var(--card)"
          strokeWidth="2.5"
        />
        <Check d="M-4 0l3 3 5-6" width={2.4} />
      </g>
      <rect
        x="140"
        y="54"
        width="96"
        height="9"
        rx="2"
        fill="var(--foreground)"
        fillOpacity="0.8"
      />
      <rect
        x="140"
        y="68"
        width="60"
        height="6"
        rx="2"
        fill={LINE}
        fillOpacity="0.4"
      />
      {rows.map((r, i) => (
        <g key={i} transform={`translate(96 ${96 + i * 29})`}>
          <rect
            width="200"
            height="23"
            rx="3"
            fill="var(--background)"
            stroke="var(--border)"
            strokeWidth="1.5"
          />
          <circle cx="13" cy="11.5" r="7" fill="var(--secondary)" />
          <rect
            x="9"
            y="9.5"
            width="8"
            height="4"
            rx="1.5"
            fill="var(--primary)"
            fillOpacity="0.7"
          />
          <rect
            x="28"
            y="8"
            width={r.w}
            height="7"
            rx="2"
            fill="var(--foreground)"
            fillOpacity="0.7"
          />
          <rect
            x={192 - r.chipW}
            y="5.5"
            width={r.chipW}
            height="12"
            rx="3"
            fill={r.chip}
            fillOpacity="0.9"
          />
        </g>
      ))}
      <Sparkle x={292} y={58} s={8} />
    </svg>
  );
}
