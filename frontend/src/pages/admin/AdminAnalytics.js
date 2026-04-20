import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Loader2, TrendingUp, DollarSign, Users, ShoppingBag, Truck, Store, Utensils, Clock } from "lucide-react";

const API = "/api";
const RANGE_OPTIONS = [
  { v: "day", label: "Today" },
  { v: "week", label: "7 days" },
  { v: "month", label: "30 days" },
  { v: "quarter", label: "90 days" },
  { v: "year", label: "1 year" },
];
const FULFILL_ICON = { delivery: Truck, pickup: Store, dine_in: Utensils };

function Card({ label, value, icon: Icon, tone = "default", testid }) {
  const toneCls = {
    default: "bg-white border-brand-border",
    primary: "bg-brand-primary/5 border-brand-primary/20",
    success: "bg-green-50 border-green-200",
  }[tone];
  return (
    <div data-testid={testid} className={`rounded-xl border p-4 ${toneCls}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-brand-text-secondary font-semibold">{label}</span>
        {Icon && <Icon size={14} className="text-brand-primary" />}
      </div>
      <div className="font-heading text-2xl font-bold text-brand-text">{value}</div>
    </div>
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
      </div>

      {loading || !data ? (
        <div className="py-20 flex justify-center"><Loader2 size={28} className="animate-spin text-brand-primary" /></div>
      ) : (
        <div className="space-y-6">
          {/* Top-line KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card testid="kpi-revenue" label="Revenue" value={`$${data.total_revenue.toFixed(2)}`} icon={DollarSign} tone="primary" />
            <Card testid="kpi-orders" label="Orders" value={data.order_count} icon={ShoppingBag} />
            <Card testid="kpi-aov" label="Avg order value" value={`$${data.average_order_value.toFixed(2)}`} icon={TrendingUp} />
            <Card testid="kpi-customers" label="Customers" value={data.customers.unique} icon={Users} />
          </div>

          {/* Revenue over time */}
          <section className="bg-white border border-brand-border rounded-xl p-5">
            <h2 className="font-heading text-base font-bold text-brand-text mb-4 inline-flex items-center gap-2">
              <TrendingUp size={16} className="text-brand-primary" /> Revenue over time
            </h2>
            {data.revenue_over_time.length === 0 ? (
              <div className="text-sm text-brand-text-secondary">No data yet.</div>
            ) : (
              <div className="flex items-end gap-1.5 h-48" data-testid="revenue-chart">
                {data.revenue_over_time.map((b, i) => {
                  const h = Math.max(2, Math.round((b.revenue / maxRev) * 100));
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${b.label}: $${b.revenue}`}>
                      <div className="w-full bg-brand-primary/70 hover:bg-brand-primary rounded-t transition" style={{ height: `${h}%` }} />
                      <div className="text-[9px] text-brand-text-secondary truncate w-full text-center">{b.label}</div>
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
                <div className="space-y-3" data-testid="top-items-list">
                  {data.top_items.map((it) => (
                    <div key={it.name}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-body font-semibold text-brand-text truncate">{it.name}</span>
                        <span className="text-xs text-brand-text-secondary whitespace-nowrap">{it.qty} sold · ${it.revenue.toFixed(2)}</span>
                      </div>
                      <div className="mt-1.5 h-2 bg-brand-surface rounded-full overflow-hidden">
                        <Bar value={it.revenue} max={maxTopItem} />
                      </div>
                    </div>
                  ))}
                </div>
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
            {/* Busy hours */}
            <section className="bg-white border border-brand-border rounded-xl p-5">
              <h2 className="font-heading text-base font-bold text-brand-text mb-4 inline-flex items-center gap-2">
                <Clock size={16} className="text-brand-primary" /> Busy hours (UTC)
              </h2>
              <div className="flex items-end gap-1 h-32" data-testid="busy-hours-chart">
                {data.busy_hours.map((h) => {
                  const pct = Math.max(2, Math.round((h.orders / maxHourly) * 100));
                  return (
                    <div key={h.hour} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${h.hour}:00 — ${h.orders} orders`}>
                      <div className="w-full bg-brand-primary/40 rounded-t" style={{ height: `${pct}%` }} />
                      {h.hour % 3 === 0 && <div className="text-[9px] text-brand-text-secondary">{h.hour}</div>}
                    </div>
                  );
                })}
              </div>
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

          {/* Top categories */}
          {data.top_categories.length > 0 && (
            <section className="bg-white border border-brand-border rounded-xl p-5">
              <h2 className="font-heading text-base font-bold text-brand-text mb-4">Revenue by category</h2>
              <div className="space-y-3" data-testid="top-categories-list">
                {data.top_categories.map((c) => (
                  <div key={c.category}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize font-body font-semibold text-brand-text">{c.category}</span>
                      <span className="text-xs text-brand-text-secondary">${c.revenue.toFixed(2)}</span>
                    </div>
                    <div className="mt-1.5 h-2 bg-brand-surface rounded-full overflow-hidden">
                      <Bar value={c.revenue} max={data.top_categories[0].revenue} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
