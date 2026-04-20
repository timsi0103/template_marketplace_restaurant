import { useMemo } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * 7x24 heatmap: rows=day-of-week, cols=hour.
 * Color intensity scales from bg-brand-bg (low) → bg-brand-primary (high).
 */
export default function PeakHoursHeatmap({ data }) {
  const matrix = Array.isArray(data) && data.length === 7 ? data : Array.from({ length: 7 }, () => Array(24).fill(0));
  const max = useMemo(() => Math.max(1, ...matrix.flat()), [matrix]);

  const intensity = (v) => {
    if (v === 0) return "bg-brand-bg";
    const ratio = v / max;
    if (ratio < 0.2) return "bg-brand-primary/15";
    if (ratio < 0.4) return "bg-brand-primary/30";
    if (ratio < 0.6) return "bg-brand-primary/50";
    if (ratio < 0.8) return "bg-brand-primary/75";
    return "bg-brand-primary";
  };

  return (
    <div data-testid="peak-hours-heatmap" className="w-full overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Hour header */}
        <div className="grid" style={{ gridTemplateColumns: "42px repeat(24, minmax(18px, 1fr))" }}>
          <div />
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="text-[9px] text-brand-text-secondary text-center pb-1">
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {matrix.map((row, d) => (
          <div key={d} className="grid items-center" style={{ gridTemplateColumns: "42px repeat(24, minmax(18px, 1fr))" }}>
            <div className="text-[10px] text-brand-text-secondary font-semibold pr-2 text-right">{DAYS[d]}</div>
            {row.map((v, h) => (
              <div
                key={h}
                data-testid={`heatmap-cell-${d}-${h}`}
                data-value={v}
                title={`${DAYS[d]} ${h}:00 — ${v} order${v === 1 ? "" : "s"}`}
                className={`h-5 m-[1px] rounded-sm ${intensity(v)} transition`}
              />
            ))}
          </div>
        ))}
        <div className="flex items-center justify-end gap-1.5 mt-3 text-[9px] text-brand-text-secondary">
          <span>Less</span>
          {["bg-brand-bg", "bg-brand-primary/15", "bg-brand-primary/30", "bg-brand-primary/50", "bg-brand-primary/75", "bg-brand-primary"].map((c, i) => (
            <span key={i} className={`inline-block w-3 h-3 rounded-sm border border-brand-border ${c}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
