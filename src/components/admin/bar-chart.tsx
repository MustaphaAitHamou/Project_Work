"use client";
import { useEffect, useRef, useState } from "react";

export interface BarDatum {
  label: string;
  value: number;
}

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/**
 * Single-series vertical bar chart (one hue, validated for both themes): thin bars
 * with a 2px gap, 4px rounded data-ends anchored to the baseline, recessive axis,
 * hover/focus tooltip and a data table for screen readers and keyboard users.
 */
export function BarChart({
  title,
  data,
  format = (n) => String(n),
  height = 150,
  tableLabels,
}: {
  title: string;
  data: BarDatum[];
  format?: (n: number) => string;
  height?: number;
  tableLabels: { show: string; period: string; value: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.floor(entry.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const padL = 36;
  const padR = 4;
  const padT = 10;
  const padB = 22;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const band = innerW / Math.max(data.length, 1);
  const gap = 2;
  const bw = Math.max(2, band - gap);
  const baseline = padT + innerH;
  const bars = data.map((d, i) => {
    const h = max ? (d.value / max) * innerH : 0;
    const x = padL + i * band + gap / 2;
    const y = baseline - h;
    const r = Math.min(4, bw / 2, h);
    const path = h <= 0 ? "" : `M${x},${baseline} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + bw - r},${y} Q${x + bw},${y} ${x + bw},${y + r} L${x + bw},${baseline} Z`;
    return { ...d, x, y, h, path };
  });
  const labelIdx = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]);
  const a = active !== null ? bars[active] : null;
  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <div ref={ref} className="relative" onMouseLeave={() => setActive(null)}>
        <svg width={width} height={height} role="group" aria-label={title} className="block overflow-visible">
          <line x1={padL} x2={width - padR} y1={padT} y2={padT} className="stroke-border" strokeDasharray="2 3" />
          <text x={padL - 6} y={padT + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {format(max)}
          </text>
          <text x={padL - 6} y={baseline + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
            0
          </text>
          {bars.map((b, i) => (
            <g key={b.label}>
              {b.path && <path d={b.path} className={active === null || active === i ? "fill-chart-1" : "fill-chart-1 opacity-60"} />}
              <rect
                x={padL + i * band}
                y={padT}
                width={band}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${b.label} : ${format(b.value)}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none focus-visible:stroke-ring"
              />
              {labelIdx.has(i) && (
                <text x={padL + i * band + band / 2} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {b.label}
                </text>
              )}
            </g>
          ))}
          <line x1={padL} x2={width - padR} y1={baseline} y2={baseline} className="stroke-border" />
        </svg>
        {a && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
            style={{ left: a.x + bw / 2, top: Math.max(a.y - 6, 0) }}
          >
            <span className="block text-muted-foreground">{a.label}</span>
            <span className="font-semibold tabular-nums">{format(a.value)}</span>
          </div>
        )}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">{tableLabels.show}</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="text-start font-medium">
                {tableLabels.period}
              </th>
              <th scope="col" className="text-end font-medium">
                {tableLabels.value}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.label}</td>
                <td className="text-end tabular-nums">{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
