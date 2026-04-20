const COLORS = ["#6E1C1E", "#E55A3D", "#D4A456", "#1E3A2F", "#8B5A2B", "#4B6D80", "#8A5F7A"];

/**
 * Simple SVG donut chart for category revenue split.
 * Data: [{category, revenue}]
 */
export default function CategoryDonut({ data = [], size = 180, stroke = 28 }) {
  const total = data.reduce((a, b) => a + Number(b.revenue || 0), 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  let cumulative = 0;
  const segments = data.map((d, i) => {
    const value = Number(d.revenue || 0);
    const pct = total > 0 ? value / total : 0;
    const dash = c * pct;
    const offset = c * cumulative;
    cumulative += pct;
    return { ...d, pct, dash, offset, color: COLORS[i % COLORS.length] };
  });

  if (total === 0) {
    return <div data-testid="category-donut-empty" className="text-sm text-brand-text-secondary py-5 text-center">No category revenue yet.</div>;
  }

  return (
    <div data-testid="category-donut" className="flex items-center gap-5 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Revenue by category">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F2EDE4" strokeWidth={stroke} />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${c - s.dash}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="font-heading" style={{ fontSize: 18, fontWeight: 700, fill: "#212121" }}>
          ${total.toFixed(0)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 10, fill: "#5C5C5C", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Total
        </text>
      </svg>
      <ul className="flex-1 min-w-[180px] space-y-1.5" data-testid="category-donut-legend">
        {segments.map((s) => (
          <li key={s.category} data-testid={`donut-legend-${s.category}`} className="flex items-center justify-between text-xs gap-2">
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="capitalize font-body font-semibold text-brand-text truncate">{s.category}</span>
            </span>
            <span className="text-brand-text-secondary whitespace-nowrap">${Number(s.revenue).toFixed(2)} · {Math.round(s.pct * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
