import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Loader2, TrendingUp, TrendingDown, Minus, DollarSign, Users, ShoppingBag, Truck, Store, Utensils, Clock, Download, Flame } from "lucide-react";
import PeakHoursHeatmap from "@/components/admin/PeakHoursHeatmap";
import CategoryDonut from "@/components/admin/CategoryDonut";
import ExportDialog from "@/components/admin/ExportDialog";
import ReportScheduler from "@/components/admin/ReportScheduler";

const API = "/api";
const RANGE_OPTIONS = [
  { v: "day", label: "Today" },
  { v: "week", label: "7 days" },
  { v: "month", label: "30 days" },
  { v: "quarter", label: "90 days" },
  { v: "year", label: "1 year" },
];
const FULFILL_ICON = { delivery: Truck, pickup: Store, dine_in: Utensils };
function Card({ label, value, icon: Icon, tone = "default", testid, deltaPct }) {
  const toneCls = {
    default: "bg-white border-brand-border",
    primary: "bg-brand-primary/5 border-brand-primary/20",
    success: "bg-green-50 border-green-200",
  }[tone];
  const deltaDisplay = () => {
    if (deltaPct === null || deltaPct === undefined) return null;
    const up = deltaPct > 0; const down = deltaPct < 0;
    const Icon2 = up ? TrendingUp : down ? TrendingDown : Minus;
    const colorCls = up ? "text-green-700 bg-green-50" : down ? "text-red-700 bg-red-50" : "text-brand-text-secondary bg-brand-bg";
    return (
      <span data-testid={`${testid}-delta`} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-body font-bold ${colorCls}`}>
        <Icon2 size={10} /> {up ? "+" : ""}{deltaPct}%
      </span>
    );
  };
  return (
    <div data-testid={testid} className={`rounded-xl border p-4 ${toneCls}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-brand-text-secondary font-semibold">{label}</span>
        {Icon && <Icon size={14} className="text-brand-primary" />}
      </div>
      <div className="font-heading text-2xl font-bold text-brand-text">{value}</div>
      <div className="mt-1.5">{deltaDisplay()}</div>
    </div>
  );
}

const FULFILL_META = {
  delivery: { icon: Truck, label: "Delivery", color: "text-brand-primary" },
  pickup: { icon: Store, label: "Pickup", color: "text-brand-orange" },
  dine_in: { icon: Utensils, label: "Dine-In", color: "text-amber-700" },
};

function TodayStrip({ today }) {
  const mix = today?.fulfillment_mix || [];
  const total = mix.reduce((a, b) => a + b.count, 0);
  const find = (t) => mix.find((m) => m.type === t)?.count || 0;
  return (
    <div data-testid="today-strip" className="rounded-2xl bg-gradient-to-br from-brand-primary to-brand-primary-hover text-white p-5 sm:p-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold opacity-80">Today · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</div>
          <div className="font-heading text-2xl font-bold">Live pulse</div>
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[10px] font-body font-bold uppercase tracking-wider">
          <Flame size={11} /> Real-time
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TodayStat testid="today-orders" label="Orders" value={today?.order_count || 0} />
        <TodayStat testid="today-revenue" label="Revenue" value={`$${(today?.total_revenue || 0).toFixed(2)}`} />
        <TodayStat testid="today-aov" label="Avg order" value={`$${(today?.average_order_value || 0).toFixed(2)}`} />
        <TodayStat testid="today-mix-total" label="Mix"
          value={
            <span className="flex items-center gap-2 text-white text-sm font-body">
              {["delivery", "pickup", "dine_in"].map((t) => {
                const meta = FULFILL_META[t];
                const count = find(t);
                const Icon = meta.icon;
                return (
                  <span key={t} data-testid={`today-mix-${t}`} className="inline-flex items-center gap-1">
                    <Icon size={11} /> {count}
                  </span>
                );
              })}
              <span className="ml-auto text-[10px] opacity-70">{total} total</span>
            </span>
          }
        />
      </div>
    </div>
  );
}

function TodayStat({ label, value, testid }) {
  return (
    <div data-testid={testid} className="rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">{label}</div>
      <div className="font-heading text-xl font-bold mt-0.5">{value}</div>
    </div>
  );
}

function TrendPill({ pct, direction }) {
  if (pct === null || pct === undefined) return null;
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const cls = direction === "up" ? "text-green-700 bg-green-50" : direction === "down" ? "text-red-700 bg-red-50" : "text-brand-text-secondary bg-brand-bg";
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-body font-bold ${cls}`}>
      <Icon size={9} /> {pct > 0 ? "+" : ""}{pct}%
    </span>
  );
}

function Bar({ value, max, color = "bg-brand-primary" }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />;
}

export default function AdminAnalytics() {
  const [range, setRange] = useState("week");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/admin/analytics/summary`, { params: { range }, withCredentials: true })
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, [range]);

  const maxRev = useMemo(() => Math.max(1, ...((data?.revenue_over_time || []).map((d) => d.revenue))), [data]);
  const maxHourly = useMemo(() => Math.max(1, ...((data?.busy_hours || []).map((d) => d.orders))), [data]);
  const maxTopItem = useMemo(() => Math.max(1, ...((data?.top_items || []).map((d) => d.revenue))), [data]);
  const totalMix = useMemo(() => (data?.fulfillment_mix || []).reduce((a, b) => a + b.count, 0) || 1, [data]);

  return (
    <div data-testid="admin-analytics-page" className="p-6 sm:p-10 max-w-6xl">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-brand-text">Analytics</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">Revenue, customers, and operational insights at a glance.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-full border border-brand-border p-1 bg-brand-surface">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r.v}
                data-testid={`analytics-range-${r.v}`}
                onClick={() => setRange(r.v)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition ${range === r.v ? "bg-brand-primary text-white" : "text-brand-text-secondary"}`}
              >{r.label}</button>
            ))}
          </div>
          <button
            data-testid="open-export-btn"
            onClick={() => setExportOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-brand-primary text-white font-body text-xs font-semibold rounded-full hover:bg-brand-primary-hover"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="py-20 flex justify-center"><Loader2 size={28} className="animate-spin text-brand-primary" /></div>
      ) : (
        <div className="space-y-6">
          {/* Today strip (pinned) */}
          <TodayStrip today={data.today} />

          {/* Top-line KPIs with period comparison */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card testid="kpi-revenue" label={`Revenue (${range})`} value={`$${data.total_revenue.toFixed(2)}`} icon={DollarSign} tone="primary" deltaPct={data.previous_period?.revenue_delta_pct} />
            <Card testid="kpi-orders" label="Orders" value={data.order_count} icon={ShoppingBag} deltaPct={data.previous_period?.order_delta_pct} />
            <Card testid="kpi-aov" label="Avg order value" value={`$${data.average_order_value.toFixed(2)}`} icon={TrendingUp} deltaPct={data.previous_period?.aov_delta_pct} />
            <Card testid="kpi-customers" label="Customers" value={data.customers.unique} icon={Users} />
          </div>

          {/* Revenue over time with previous overlay */}
          <section className="bg-white border border-brand-border rounded-xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2">
                <TrendingUp size={16} className="text-brand-primary" /> Revenue trend
              </h2>
              <div className="flex items-center gap-3 text-[10px] text-brand-text-secondary">
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-primary" /> Current</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand-primary/25" /> Previous</span>
              </div>
            </div>
            {data.revenue_over_time.length === 0 ? (
              <div className="text-sm text-brand-text-secondary">No data yet.</div>
            ) : (
              <div className="flex items-end gap-1.5 h-52" data-testid="revenue-chart">
                {data.revenue_over_time.map((b, i) => {
                  const localMax = Math.max(maxRev, Math.max(1, ...data.revenue_over_time.map((x) => x.previous || 0)));
                  const h = Math.max(2, Math.round((b.revenue / localMax) * 100));
                  const prevH = Math.max(0, Math.round(((b.previous || 0) / localMax) * 100));
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${b.label}: $${b.revenue} (prev $${(b.previous || 0).toFixed(2)})`}>
                      <div className="relative w-full h-full flex items-end gap-[2px] justify-center">
                        {b.previous > 0 && (
                          <div data-testid={`revenue-prev-${i}`} className="w-1/2 bg-brand-primary/25 rounded-t" style={{ height: `${prevH}%` }} />
                        )}
                        <div data-testid={`revenue-curr-${i}`} className="w-1/2 bg-brand-primary/80 hover:bg-brand-primary rounded-t transition" style={{ height: `${h}%` }} />
                      </div>
                      <div className="text-[9px] text-brand-text-secondary truncate w-full text-center mt-1">{b.label}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Two-column */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top items */}
            <section className="bg-white border border-brand-border rounded-xl p-5">
              <h2 className="font-heading text-base font-bold text-brand-text mb-4">Top-selling items</h2>
              {data.top_items.length === 0 ? (
                <div className="text-sm text-brand-text-secondary">No paid orders in this range.</div>
              ) : (
                <ul className="space-y-3" data-testid="top-items-list">
                  {data.top_items.map((it, i) => (
                    <li key={it.name} data-testid={`top-item-${i}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-brand-bg transition">
                      <span className="w-5 text-right text-[11px] font-bold text-brand-text-secondary">#{i + 1}</span>
                      {it.image ? (
                        <img src={it.image} alt={it.name} className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-brand-bg border border-brand-border flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-body text-sm font-semibold text-brand-text truncate">{it.name}</span>
                          <TrendPill pct={it.trend_pct} direction={it.direction} />
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-brand-text-secondary mt-0.5">
                          <span>{it.qty} sold</span>
                          <span>·</span>
                          <span className="font-semibold text-brand-text">${it.revenue.toFixed(2)}</span>
                          {it.category && <><span>·</span><span className="capitalize">{it.category}</span></>}
                        </div>
                        <div className="mt-1 h-1.5 bg-brand-surface rounded-full overflow-hidden">
                          <Bar value={it.revenue} max={maxTopItem} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Fulfillment mix */}
            <section className="bg-white border border-brand-border rounded-xl p-5">
              <h2 className="font-heading text-base font-bold text-brand-text mb-4">Fulfillment mix</h2>
              {data.fulfillment_mix.length === 0 ? (
                <div className="text-sm text-brand-text-secondary">No data.</div>
              ) : (
                <div className="space-y-3" data-testid="fulfillment-mix">
                  {data.fulfillment_mix.map((f) => {
                    const Icon = FULFILL_ICON[f.type] || ShoppingBag;
                    const pct = Math.round((f.count / totalMix) * 100);
                    return (
                      <div key={f.type} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-brand-primary/5 text-brand-primary flex items-center justify-center">
                          <Icon size={16} />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-0.5">
                            <span className="capitalize font-body font-semibold text-brand-text">{f.type.replace("_", " ")}</span>
                            <span className="text-xs text-brand-text-secondary">{f.count} orders · {pct}%</span>
                          </div>
                          <Bar value={pct} max={100} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Peak hours heatmap */}
            <section className="bg-white border border-brand-border rounded-xl p-5">
              <h2 className="font-heading text-base font-bold text-brand-text mb-4 inline-flex items-center gap-2">
                <Clock size={16} className="text-brand-primary" /> Peak order hours (UTC)
              </h2>
              <PeakHoursHeatmap data={data.heatmap} />
            </section>

            {/* Customers new vs returning + top customers */}
            <section className="bg-white border border-brand-border rounded-xl p-5">
              <h2 className="font-heading text-base font-bold text-brand-text mb-4 inline-flex items-center gap-2">
                <Users size={16} className="text-brand-primary" /> Customers
              </h2>
              <div className="flex gap-3 mb-4">
                <div className="flex-1 bg-brand-surface rounded-lg p-3">
                  <div className="text-xs text-brand-text-secondary uppercase tracking-wider">New</div>
                  <div className="font-heading text-xl font-bold text-brand-text" data-testid="customers-new">{data.customers.new}</div>
                </div>
                <div className="flex-1 bg-brand-surface rounded-lg p-3">
                  <div className="text-xs text-brand-text-secondary uppercase tracking-wider">Returning</div>
                  <div className="font-heading text-xl font-bold text-brand-text" data-testid="customers-returning">{data.customers.returning}</div>
                </div>
              </div>
              <h3 className="text-xs uppercase tracking-wider text-brand-text-secondary font-semibold mb-2">Top customers</h3>
              {data.top_customers.length === 0 ? (
                <div className="text-sm text-brand-text-secondary">—</div>
              ) : (
                <ul className="space-y-2" data-testid="top-customers-list">
                  {data.top_customers.map((c, i) => (
                    <li key={c.key} className="flex items-center justify-between text-sm">
                      <span className="font-body text-brand-text truncate">{i + 1}. {c.label}</span>
                      <span className="font-semibold">${c.total.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Revenue by category donut */}
          {data.top_categories.length > 0 && (
            <section className="bg-white border border-brand-border rounded-xl p-5">
              <h2 className="font-heading text-base font-bold text-brand-text mb-4">Revenue by category</h2>
              <CategoryDonut data={data.top_categories} />
            </section>
          )}

          {/* Scheduled reports */}
          <ReportScheduler />
        </div>
      )}

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
