import { cn } from "@/lib/utils";

/**
 * Small SVG flags for the nine markets. Emoji flags are not rendered on Windows
 * (they show as letter pairs such as "FR"), so the home page draws them instead.
 * Simplified for 20 px display; no ids, safe to repeat on a page.
 */
function Flag({ code }: { code: string }) {
  switch (code) {
    case "FR":
      return (
        <>
          <rect width="10" height="20" fill="#0055A4" />
          <rect x="10" width="10" height="20" fill="#FFFFFF" />
          <rect x="20" width="10" height="20" fill="#EF4135" />
        </>
      );
    case "BE":
      return (
        <>
          <rect width="10" height="20" fill="#000000" />
          <rect x="10" width="10" height="20" fill="#FDDA24" />
          <rect x="20" width="10" height="20" fill="#EF3340" />
        </>
      );
    case "LU":
      return (
        <>
          <rect width="30" height="6.67" fill="#ED2939" />
          <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
          <rect y="13.33" width="30" height="6.67" fill="#00A1DE" />
        </>
      );
    case "ES":
      return (
        <>
          <rect width="30" height="20" fill="#AA151B" />
          <rect y="5" width="30" height="10" fill="#F1BF00" />
        </>
      );
    case "CH":
      return (
        <>
          <rect width="30" height="20" fill="#DA291C" />
          <rect x="13" y="4" width="4" height="12" fill="#FFFFFF" />
          <rect x="9" y="8" width="12" height="4" fill="#FFFFFF" />
        </>
      );
    case "DZ":
      return (
        <>
          <rect width="15" height="20" fill="#006233" />
          <rect x="15" width="15" height="20" fill="#FFFFFF" />
          {/* Crescent: outer arc (r 5) and inner arc (r 4) between their two intersections. */}
          <path
            d="M18.85 7.53A5 5 0 1 0 18.85 12.47A4 4 0 1 1 18.85 7.53Z"
            fill="#D21034"
          />
          <path
            d="M16.1 10 18.05 9.37 18.05 7.32 19.26 8.97 21.21 8.34 20.01 10 21.21 11.66 19.26 11.03 18.05 12.68 18.05 10.63Z"
            fill="#D21034"
          />
        </>
      );
    case "CA":
      return (
        <>
          <rect width="30" height="20" fill="#FFFFFF" />
          <rect width="7.5" height="20" fill="#D52B1E" />
          <rect x="22.5" width="7.5" height="20" fill="#D52B1E" />
          <path
            transform="translate(8 2.72) scale(1.4)"
            d="M5 .6 5.8 2.2 6.9 1.8 6.5 4.4 8.2 3.2 8.6 4.2 9.8 4 8.9 5.6 9.4 6 7 7.6 7.3 8.3 5.25 8 5.3 9.8 4.7 9.8 4.75 8 2.7 8.3 3 7.6 .6 6 1.1 5.6.2 4 1.4 4.2 1.8 3.2 3.5 4.4 3.1 1.8 4.2 2.2Z"
            fill="#D52B1E"
          />
        </>
      );
    case "US":
      return (
        <>
          <rect width="30" height="20" fill="#FFFFFF" />
          {[0, 2, 4, 6, 8, 10, 12].map((i) => (
            <rect
              key={i}
              y={(i * 20) / 13}
              width="30"
              height={20 / 13}
              fill="#B22234"
            />
          ))}
          <rect width="12" height={(7 * 20) / 13} fill="#3C3B6E" />
          {[1.6, 4.4, 7.2, 10].map((x) =>
            [1.7, 4.3, 6.9, 9.5].map((y) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="0.55" fill="#FFFFFF" />
            )),
          )}
        </>
      );
    case "GB":
      return (
        <g transform="translate(-7.5 -2.5) scale(0.75)">
          <rect width="60" height="30" fill="#012169" />
          <path d="M0 0 60 30M60 0 0 30" stroke="#FFFFFF" strokeWidth="6" />
          <path d="M0 0 60 30M60 0 0 30" stroke="#C8102E" strokeWidth="2" />
          <path d="M30 0v30M0 15h60" stroke="#FFFFFF" strokeWidth="10" />
          <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
        </g>
      );
    default:
      return <rect width="30" height="20" fill="currentColor" opacity="0.2" />;
  }
}

export function CountryFlag({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 30 20"
      aria-hidden
      className={cn(
        "h-3.5 w-[21px] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10",
        className,
      )}
    >
      <Flag code={code} />
    </svg>
  );
}
