import { cn } from "@/lib/utils";

/**
 * Home hero illustration (original artwork, Tamurt Services art direction).
 * "Talent before prejudice": an anonymous CV (a talent star instead of a photo, skill bars),
 * a verified job offer, a one-click apply button and a globe with the nine markets.
 * Drawn for the blue brand band, so colours are fixed in both themes. Decorative only.
 * Used once per page: the static ids below are unique.
 */
const PINS: [number, number][] = [
  [196, 118],
  [252, 86],
  [338, 76],
  [418, 112],
  [462, 182],
  [446, 262],
  [384, 328],
  [190, 300],
  [150, 206],
];

function Pin({ x, y, index }: { x: number; y: number; index: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle
        r="6"
        fill="none"
        stroke="#F8BA3C"
        strokeWidth="1.5"
        className="tj-pulse"
        style={{ animationDelay: `${index * 0.27}s` }}
      />
      <path
        d="M0 0C-5-6-7-9-7-12a7 7 0 1 1 14 0c0 3-2 6-7 12Z"
        fill={index % 3 === 0 ? "#F8BA3C" : "#FFFFFF"}
      />
      <circle cy="-12" r="2.6" fill="#172B73" />
    </g>
  );
}

function Sparkle({
  x,
  y,
  size,
  color = "#F8BA3C",
}: {
  x: number;
  y: number;
  size: number;
  color?: string;
}) {
  const s = size;
  return (
    <path
      transform={`translate(${x} ${y})`}
      d={`M0 ${-s}C${s * 0.18} ${-s * 0.18} ${s * 0.18} ${-s * 0.18} ${s} 0C${s * 0.18} ${s * 0.18} ${s * 0.18} ${s * 0.18} 0 ${s}C${-s * 0.18} ${s * 0.18} ${-s * 0.18} ${s * 0.18} ${-s} 0C${-s * 0.18} ${-s * 0.18} ${-s * 0.18} ${-s * 0.18} 0 ${-s}Z`}
      fill={color}
    />
  );
}

export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 440" aria-hidden className={cn("h-auto", className)}>
      <defs>
        <filter
          id="tj-hero-shadow"
          x="-20%"
          y="-20%"
          width="140%"
          height="150%"
        >
          <feDropShadow
            dx="0"
            dy="12"
            stdDeviation="12"
            floodColor="#0B1640"
            floodOpacity="0.38"
          />
        </filter>
      </defs>

      {/* Globe: the nine markets */}
      <circle
        cx="300"
        cy="200"
        r="168"
        fill="#FFFFFF"
        fillOpacity="0.06"
        stroke="#FFFFFF"
        strokeOpacity="0.22"
        strokeWidth="1.5"
      />
      <g fill="none" stroke="#FFFFFF" strokeOpacity="0.13" strokeWidth="1.2">
        <ellipse cx="300" cy="200" rx="64" ry="168" />
        <ellipse cx="300" cy="200" rx="124" ry="168" />
        <path d="M150 130H450M132 200H468M150 270H450" />
      </g>
      {PINS.map(([x, y], i) => (
        <Pin key={`${x}-${y}`} x={x} y={y} index={i} />
      ))}

      {/* Verified job offer */}
      <g className="tj-float-2">
        <g
          transform="translate(292 44) rotate(4)"
          filter="url(#tj-hero-shadow)"
        >
          <rect width="200" height="150" rx="6" fill="#FFFFFF" />
          <rect x="18" y="20" width="40" height="40" rx="4" fill="#2747B0" />
          <path
            d="M33 33v-3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <rect x="27" y="33" width="22" height="16" rx="2.5" fill="#FFFFFF" />
          <path d="M27 40h22" stroke="#2747B0" strokeWidth="1.6" />
          <rect
            x="70"
            y="24"
            width="104"
            height="10"
            rx="2"
            fill="#1D1B19"
            fillOpacity="0.88"
          />
          <rect x="70" y="42" width="72" height="7" rx="2" fill="#C9CFE6" />
          <path
            d="M24 84c-3.6-4.3-5-6.5-5-8.6a5 5 0 1 1 10 0c0 2.1-1.4 4.3-5 8.6Z"
            fill="#2747B0"
          />
          <rect x="36" y="73" width="84" height="7" rx="2" fill="#C9CFE6" />
          <rect x="18" y="98" width="74" height="22" rx="4" fill="#FFF3D6" />
          <rect x="28" y="106" width="54" height="6" rx="2" fill="#B87A00" />
          <rect x="100" y="98" width="58" height="22" rx="4" fill="#E8EDFB" />
          <rect x="110" y="106" width="38" height="6" rx="2" fill="#2747B0" />
          <rect x="18" y="130" width="164" height="6" rx="2" fill="#EEF1FB" />
          <circle
            cx="196"
            cy="4"
            r="18"
            fill="#0B6E5B"
            stroke="#FFFFFF"
            strokeWidth="3"
          />
          <path
            d="M187.5 4.5l5.5 5.5 11-11"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
      <Sparkle x={498} y={30} size={11} />
      <Sparkle x={474} y={58} size={6} color="#FFFFFF" />

      {/* One-click path from the CV to the offer */}
      <path
        d="M246 196C268 150 276 128 318 118"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.85"
        strokeWidth="2.5"
        strokeDasharray="2 9"
        strokeLinecap="round"
        className="tj-dash"
      />
      <path
        d="M306 108l13 10-15 6"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.85"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Anonymous CV: a talent star instead of a photo */}
      <g className="tj-float">
        <g
          transform="translate(34 176) rotate(-5)"
          filter="url(#tj-hero-shadow)"
        >
          <rect width="236" height="206" rx="6" fill="#FFFFFF" />
          <circle cx="46" cy="46" r="27" fill="#E8EDFB" />
          <path
            d="M46 31.5 50.2 40.6 60.1 41.7 52.8 48.4 54.8 58.2 46 53.2 37.2 58.2 39.2 48.4 31.9 41.7 41.8 40.6Z"
            fill="#F8BA3C"
          />
          <rect
            x="84"
            y="30"
            width="112"
            height="10"
            rx="2"
            fill="#1D1B19"
            fillOpacity="0.88"
          />
          <rect x="84" y="48" width="78" height="7" rx="2" fill="#C9CFE6" />
          {[
            [86, 114, "#2747B0"],
            [110, 86, "#2747B0"],
            [134, 124, "#3A62E0"],
          ].map(([y, w, color]) => (
            <g key={y as number}>
              <rect
                x="20"
                y={(y as number) - 1}
                width="54"
                height="7"
                rx="2"
                fill="#C9CFE6"
              />
              <rect
                x="86"
                y={(y as number) - 2}
                width="130"
                height="9"
                rx="4.5"
                fill="#E8EDFB"
              />
              <rect
                x="86"
                y={(y as number) - 2}
                width={w as number}
                height="9"
                rx="4.5"
                fill={color as string}
              />
            </g>
          ))}
          {[
            [20, 56],
            [84, 66],
            [158, 58],
          ].map(([x, w]) => (
            <g key={x}>
              <rect x={x} y="160" width={w} height="24" rx="4" fill="#E8EDFB" />
              <circle cx={x + 11} cy="172" r="4" fill="#2747B0" />
              <rect
                x={x + 20}
                y="169"
                width={w - 28}
                height="6"
                rx="2"
                fill="#2747B0"
                fillOpacity="0.45"
              />
            </g>
          ))}
        </g>
      </g>
      <Sparkle x={30} y={170} size={9} />

      {/* Apply in one click */}
      <g className="tj-float-3">
        <g transform="translate(290 262)">
          <rect
            width="162"
            height="48"
            rx="4"
            fill="#FFFFFF"
            filter="url(#tj-hero-shadow)"
          />
          <circle cx="27" cy="24" r="12" fill="#2747B0" />
          <path
            d="M21.5 24.5l4 4 7.5-8"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="48" y="18" width="88" height="11" rx="2" fill="#2747B0" />
          <g transform="translate(126 30)">
            <path
              d="M-8-8l-7-7M2-11v-9M-11 2h-9"
              stroke="#F8BA3C"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M0 0v28l7.5-7.2 5.2 12 5.6-2.4-5.2-11.8H24Z"
              fill="#FFFFFF"
              stroke="#1D1B19"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          </g>
        </g>
      </g>
      <Sparkle x={476} y={350} size={8} color="#FFFFFF" />
    </svg>
  );
}
