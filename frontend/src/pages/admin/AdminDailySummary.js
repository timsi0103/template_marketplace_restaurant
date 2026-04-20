import { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Loader2, TrendingUp, TrendingDown, Minus, Printer, Mail, Plus, Trash2, Archive,
  Calendar, Download, X, DollarSign, ShoppingBag, Users, Truck, Store, Utensils, RefreshCcw, Zap, AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const API = "/api";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function Delta({ pct }) {
  if (pct === null || pct === undefined) return <span className="text-brand-text-secondary text-[10px]">—</span>;
  const up = pct > 0; const down = pct < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const cls = up ? "text-green-700 bg-green-50" : down ? "text-red-700 bg-red-50" : "text-brand-text-secondary bg-brand-bg";
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-body font-bold ${cls}`}>
      <Icon size={10} /> {pct > 0 ? "+" : ""}{pct}%
    </span>
  );
}

export default function AdminDailySummary() {
  const [date, setDate] = useState(() => {
    const sp = new URLSearchParams(window.location.search);
    return sp.get("date") || todayISO();
  });
  const printMode = useMemo(() => new URLSearchParams(window.location.search).get("print") === "1", []);

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState(null);

  const loadSummary = useCallback(async (d) => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/daily-summary`, { params: { date: d }, withCredentials: true });
      setSummary(data);
    } finally { setLoading(false); }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/admin/daily-summary/history`, { withCredentials: true });
      setHistory(data.snapshots || []);
    } catch { /* ignore */ }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/admin/daily-summary/delivery-settings`, { withCredentials: true });
      setSettings(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadSummary(date); }, [date, loadSummary]);
  useEffect(() => { loadHistory(); loadSettings(); }, [loadHistory, loadSettings]);

  // Print-mode auto-trigger: after content renders, open the system print dialog.
  useEffect(() => {
    if (printMode && summary && !loading) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [printMode, summary, loading]);

  const generate = async (sendEmail) => {
    setGenerating(true);
    try {
      const { data } = await axios.post(`${API}/admin/daily-summary/generate`, { date, send_email: sendEmail }, { withCredentials: true });
      toast.success(
        sendEmail
          ? `Report generated · ${(data.recipients || []).length ? `emailed (MOCKED) to ${data.recipients.length}` : "no recipients set"}`
          : "Report snapshot archived"
      );
      loadHistory();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Generation failed");
    } finally { setGenerating(false); }
  };

  const openPrint = () => {
    const url = `/admin/daily-summary?date=${date}&print=1`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (loading && !summary) {
    return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-brand-primary" /></div>;
  }

  return (
    <div data-testid="admin-daily-summary-page" className={`${printMode ? "bg-white" : ""} p-6 lg:p-10 max-w-6xl space-y-8`}>
      {/* Print-only styles */}
      <style>{`
        @media print {
          body, html { background: white !important; }
          [data-print-hide], nav, aside, header, [data-testid="admin-sidebar"], [data-testid="admin-mobile-header"] { display: none !important; }
          [data-testid="admin-daily-summary-page"] { max-width: 100% !important; padding: 24px !important; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      {!printMode && (
        <div data-print-hide className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 data-testid="daily-summary-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">Daily summary</h1>
            <p className="font-body text-sm text-brand-text-secondary mt-1">End-of-day overview — orders, revenue, items, customers, comparisons.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input data-testid="ds-date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" />
            <button data-testid="ds-today-btn" onClick={() => setDate(todayISO())} className="inline-flex items-center gap-1 h-9 px-3 border border-brand-border rounded-full text-xs font-body font-semibold">Today</button>
            <button data-testid="ds-refresh-btn" onClick={() => loadSummary(date)} className="inline-flex items-center gap-1 h-9 px-3 border border-brand-border rounded-full text-xs font-body font-semibold hover:border-brand-primary/50">
              <RefreshCcw size={11} /> Refresh
            </button>
            <button data-testid="ds-print-btn" onClick={openPrint} className="inline-flex items-center gap-1 h-9 px-4 bg-brand-text text-white rounded-full text-xs font-body font-semibold hover:bg-brand-text/90">
              <Printer size={12} /> Print
            </button>
            <button
              data-testid="ds-generate-btn"
              onClick={() => generate(false)}
              disabled={generating}
              className="inline-flex items-center gap-1 h-9 px-4 bg-brand-primary text-white rounded-full text-xs font-body font-semibold hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {generating ? <Loader2 size={11} className="animate-spin" /> : <Archive size={11} />} Generate snapshot
            </button>
            <button
              data-testid="ds-email-btn"
              onClick={() => generate(true)}
              disabled={generating}
              className="inline-flex items-center gap-1 h-9 px-4 bg-brand-orange text-white rounded-full text-xs font-body font-semibold hover:bg-brand-orange-hover disabled:opacity-50"
            >
              <Mail size={11} /> Generate & email
            </button>
          </div>
        </div>
      )}

      {summary && <SummaryContent summary={summary} />}

      {!printMode && (
        <>
          <ReportHistory items={history} onRefresh={loadHistory} onLoad={(s) => setDate(s.date)} />
          {settings && <DeliverySettings value={settings} onChange={setSettings} />}
        </>
      )}
    </div>
  );
}

/* ─── Summary content ──────────────────────────────── */
function SummaryContent({ summary }) {
  const { compare_last_week: lw, compare_last_month: lm } = summary;
  const mix = summary.fulfillment_mix || [];
  const find = (t) => mix.find((m) => m.type === t)?.count || 0;

  return (
    <section data-testid="summary-content" className="space-y-6 bg-white border border-brand-border rounded-2xl p-6 print:border-0 print:shadow-none">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-brand-text-secondary font-semibold">Summary for</div>
          <div className="font-heading text-2xl font-bold text-brand-text">
            {new Date(summary.date + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
        <span data-testid="ds-date-label" className="font-body text-xs text-brand-text-secondary">{summary.date}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI testid="ds-kpi-orders" label="Orders" value={summary.order_count} icon={ShoppingBag} delta={lw.order_delta_pct} sub={`vs ${lw.order_count} LW`} />
        <KPI testid="ds-kpi-revenue" label="Revenue" value={`$${summary.total_revenue.toFixed(2)}`} icon={DollarSign} delta={lw.revenue_delta_pct} sub={`vs $${lw.total_revenue.toFixed(2)} LW`} tone="primary" />
        <KPI testid="ds-kpi-aov" label="Avg order" value={`$${summary.average_order_value.toFixed(2)}`} icon={TrendingUp} delta={lw.aov_delta_pct} sub={`vs $${lw.aov.toFixed(2)} LW`} />
        <KPI testid="ds-kpi-tips" label="Tips" value={`$${summary.tips.toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div data-testid="ds-mix-card" className="bg-brand-bg rounded-xl p-4">
          <h3 className="font-heading text-sm font-bold text-brand-text mb-3">Orders by type</h3>
          <div className="grid grid-cols-3 gap-2">
            <MixStat icon={Truck} label="Delivery" count={find("delivery")} total={summary.order_count} testid="ds-mix-delivery" />
            <MixStat icon={Store} label="Pickup" count={find("pickup")} total={summary.order_count} testid="ds-mix-pickup" />
            <MixStat icon={Utensils} label="Dine-In" count={find("dine_in")} total={summary.order_count} testid="ds-mix-dinein" />
          </div>
        </div>

        <div data-testid="ds-customers-card" className="bg-brand-bg rounded-xl p-4">
          <h3 className="font-heading text-sm font-bold text-brand-text mb-3 inline-flex items-center gap-2"><Users size={14} /> Customers</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <div className="h-2 bg-brand-border/60 rounded-full overflow-hidden">
                <div data-testid="ds-customers-returning-bar" className="h-full bg-brand-primary" style={{ width: `${summary.customers.returning_ratio}%` }} />
              </div>
              <div className="flex justify-between text-[11px] mt-1.5 text-brand-text-secondary">
                <span><span className="font-heading font-bold text-brand-text">{summary.customers.returning}</span> returning</span>
                <span><span className="font-heading font-bold text-brand-text">{summary.customers.new}</span> new</span>
              </div>
            </div>
            <div className="font-heading text-xl font-bold text-brand-text">{summary.customers.returning_ratio}%</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div data-testid="ds-top-items-card" className="bg-brand-bg rounded-xl p-4">
          <h3 className="font-heading text-sm font-bold text-brand-text mb-3">Top 5 items</h3>
          {summary.top_items.length === 0 ? (
            <p className="text-xs text-brand-text-secondary">No paid orders today.</p>
          ) : (
            <ol className="space-y-2" data-testid="ds-top-items-list">
              {summary.top_items.map((it, i) => (
                <li key={it.name} data-testid={`ds-top-item-${i}`} className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                  <span className="flex-1 truncate font-body font-semibold text-brand-text">{it.name}</span>
                  <span className="text-xs text-brand-text-secondary">{it.qty}× · ${it.revenue.toFixed(2)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div data-testid="ds-issues-card" className="bg-brand-bg rounded-xl p-4">
          <h3 className="font-heading text-sm font-bold text-brand-text mb-3">Refunds & cancellations</h3>
          <div className="grid grid-cols-2 gap-2">
            <div data-testid="ds-refunds" className="rounded-lg bg-white border border-brand-border p-3">
              <div className="text-[10px] uppercase tracking-widest text-brand-text-secondary font-semibold">Refunded</div>
              <div className={`font-heading text-2xl font-bold ${summary.refunds_count > 0 ? "text-red-700" : "text-brand-text"}`}>{summary.refunds_count}</div>
            </div>
            <div data-testid="ds-cancellations" className="rounded-lg bg-white border border-brand-border p-3">
              <div className="text-[10px] uppercase tracking-widest text-brand-text-secondary font-semibold">Cancelled</div>
              <div className={`font-heading text-2xl font-bold ${summary.cancellations_count > 0 ? "text-amber-700" : "text-brand-text"}`}>{summary.cancellations_count}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="ds-comparisons">
        <div className="rounded-xl bg-white border border-brand-border p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-heading text-sm font-bold text-brand-text">Today vs same day last week</h3>
            <span className="text-[10px] text-brand-text-secondary">{lw.date}</span>
          </div>
          <CompareRow testid="ds-lw-revenue" label="Revenue" current={`$${summary.total_revenue.toFixed(2)}`} previous={`$${lw.total_revenue.toFixed(2)}`} pct={lw.revenue_delta_pct} />
          <CompareRow testid="ds-lw-orders" label="Orders" current={summary.order_count} previous={lw.order_count} pct={lw.order_delta_pct} />
          <CompareRow testid="ds-lw-aov" label="AOV" current={`$${summary.average_order_value.toFixed(2)}`} previous={`$${lw.aov.toFixed(2)}`} pct={lw.aov_delta_pct} />
        </div>

        <div className="rounded-xl bg-white border border-brand-border p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-heading text-sm font-bold text-brand-text">Month-to-date vs previous month</h3>
          </div>
          <CompareRow testid="ds-lm-revenue" label="Revenue" current={`$${lm.mtd.total_revenue.toFixed(2)}`} previous={`$${lm.prev_mtd.total_revenue.toFixed(2)}`} pct={lm.revenue_delta_pct} />
          <CompareRow testid="ds-lm-orders" label="Orders" current={lm.mtd.order_count} previous={lm.prev_mtd.order_count} pct={lm.order_delta_pct} />
        </div>
      </div>
    </section>
  );
}

function KPI({ label, value, icon: Icon, tone = "default", delta, sub, testid }) {
  const toneCls = tone === "primary" ? "bg-brand-primary/5 border-brand-primary/20" : "bg-white border-brand-border";
  return (
    <div data-testid={testid} className={`rounded-xl border p-4 ${toneCls}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-widest text-brand-text-secondary font-semibold">{label}</span>
        {Icon && <Icon size={13} className="text-brand-primary" />}
      </div>
      <div className="font-heading text-2xl font-bold text-brand-text">{value}</div>
      <div className="flex items-center gap-1.5 mt-1.5">
        <Delta pct={delta} />
        {sub && <span className="text-[10px] text-brand-text-secondary">{sub}</span>}
      </div>
    </div>
  );
}

function MixStat({ icon: Icon, label, count, total, testid }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div data-testid={testid} className="bg-white border border-brand-border rounded-lg p-2.5">
      <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary"><Icon size={12} /> {label}</div>
      <div className="font-heading text-xl font-bold text-brand-text">{count}</div>
      <div className="text-[10px] text-brand-text-secondary">{pct}%</div>
    </div>
  );
}

function CompareRow({ label, current, previous, pct, testid }) {
  return (
    <div data-testid={testid} className="flex items-center justify-between py-1.5 text-sm border-b border-brand-border/50 last:border-0">
      <span className="text-brand-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-heading font-bold text-brand-text">{current}</span>
        <span className="text-[11px] text-brand-text-secondary">(prev: {previous})</span>
        <Delta pct={pct} />
      </div>
    </div>
  );
}

/* ─── Report history ───────────────────────────────── */
function ReportHistory({ items, onRefresh, onLoad }) {
  const [query, setQuery] = useState("");
  const filtered = items.filter((s) => !query || s.date.includes(query));

  const remove = async (s) => {
    if (!window.confirm(`Delete snapshot ${s.date} (${s.id})?`)) return;
    try {
      await axios.delete(`${API}/admin/daily-summary/${s.id}`, { withCredentials: true });
      toast.success("Snapshot removed");
      onRefresh();
    } catch { toast.error("Delete failed"); }
  };

  const downloadJson = (s) => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `daily_summary_${s.date}_${s.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section data-testid="report-history" data-print-hide className="bg-brand-surface border border-brand-border rounded-2xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2">
          <Archive size={15} className="text-brand-primary" /> Report history
        </h2>
        <div className="flex items-center gap-2">
          <Input data-testid="history-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by date (YYYY-MM-DD)" className="h-9 w-52" />
          <button data-testid="history-refresh" onClick={onRefresh} className="inline-flex items-center gap-1 h-9 px-3 border border-brand-border rounded-full text-xs font-body font-semibold hover:border-brand-primary/50">
            <RefreshCcw size={11} /> Refresh
          </button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div data-testid="history-empty" className="text-center py-8 text-sm text-brand-text-secondary">No snapshots yet. Click <strong>Generate snapshot</strong> above to archive today's report.</div>
      ) : (
        <ul className="divide-y divide-brand-border border border-brand-border rounded-lg overflow-hidden" data-testid="history-list">
          {filtered.map((s) => (
            <li key={s.id} data-testid={`history-row-${s.id}`} className="flex items-center gap-3 px-3 py-2.5 bg-brand-bg/30">
              <div className="w-9 h-9 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0"><Calendar size={14} /></div>
              <div className="flex-1 min-w-0">
                <div className="font-heading text-sm font-bold text-brand-text">{s.date}</div>
                <div className="text-[11px] text-brand-text-secondary mt-0.5">
                  {s.summary?.order_count || 0} orders · ${Number(s.summary?.total_revenue || 0).toFixed(2)} · generated {new Date(s.generated_at).toLocaleString()}
                  {s.delivery_status && <> · <span className={s.delivery_status === "sent" ? "text-green-700" : "text-amber-700"}>{s.delivery_status.replace(/_/g, " ")}</span></>}
                </div>
              </div>
              <button data-testid={`history-load-${s.id}`} onClick={() => onLoad(s)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-primary hover:underline">
                <Zap size={11} /> View
              </button>
              <button data-testid={`history-download-${s.id}`} onClick={() => downloadJson(s)} className="p-1.5 rounded-md text-brand-text-secondary hover:text-brand-primary hover:bg-white" aria-label="Download JSON">
                <Download size={13} />
              </button>
              <button data-testid={`history-delete-${s.id}`} onClick={() => remove(s)} className="p-1.5 rounded-md text-brand-text-secondary hover:text-red-600 hover:bg-red-50" aria-label="Delete">
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ─── Delivery settings ────────────────────────────── */
function DeliverySettings({ value, onChange }) {
  const [local, setLocal] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => setLocal(value), [value]);
  const dirty = JSON.stringify(local) !== JSON.stringify(value);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await axios.patch(`${API}/admin/daily-summary/delivery-settings`, {
        enabled: local.enabled,
        recipients: local.recipients,
        send_at: local.send_at,
        format: local.format,
      }, { withCredentials: true });
      onChange(data);
      toast.success("Delivery settings saved");
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  const addRecipient = () => {
    const email = window.prompt("Recipient email:");
    if (!email || !/\S+@\S+\.\S+/.test(email)) return;
    setLocal({ ...local, recipients: Array.from(new Set([...(local.recipients || []), email.toLowerCase()])) });
  };
  const removeRecipient = (email) => {
    setLocal({ ...local, recipients: (local.recipients || []).filter((e) => e !== email) });
  };

  return (
    <section data-testid="delivery-settings" data-print-hide className="bg-brand-surface border border-brand-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2">
          <Mail size={15} className="text-brand-primary" /> Automatic delivery
        </h2>
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-body font-bold uppercase tracking-wider">
          <AlertTriangle size={10} /> Email delivery MOCKED
        </span>
      </div>
      <p className="text-xs text-brand-text-secondary mb-4">Automate an end-of-day report emailed to your team.</p>

      <div className="grid grid-cols-1 sm:grid-cols-[auto_140px_140px_auto] gap-3 items-end mb-4">
        <label className="inline-flex items-center gap-2">
          <Switch data-testid="delivery-enabled-switch" checked={!!local.enabled} onCheckedChange={(v) => setLocal({ ...local, enabled: v })} />
          <span className="text-xs text-brand-text font-medium">{local.enabled ? "Enabled" : "Disabled"}</span>
        </label>
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1 block">Send at (HH:MM)</Label>
          <Input data-testid="delivery-send-at" type="time" value={local.send_at} onChange={(e) => setLocal({ ...local, send_at: e.target.value })} className="h-9" />
        </div>
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1 block">Format</Label>
          <select data-testid="delivery-format-select" value={local.format} onChange={(e) => setLocal({ ...local, format: e.target.value })} className="h-9 w-full rounded-md border border-brand-border bg-white text-sm px-2">
            <option value="pdf">PDF</option>
            <option value="html">HTML email</option>
            <option value="csv">CSV</option>
          </select>
        </div>
        <button
          data-testid="delivery-save-btn"
          disabled={!dirty || saving}
          onClick={save}
          className="inline-flex items-center gap-1 h-9 px-4 bg-brand-primary text-white text-xs font-body font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : null} Save
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary font-semibold">Recipients</Label>
          <button data-testid="delivery-add-recipient" onClick={addRecipient} className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline">
            <Plus size={11} /> Add email
          </button>
        </div>
        {(local.recipients || []).length === 0 ? (
          <div data-testid="delivery-recipients-empty" className="text-xs text-brand-text-secondary py-2">No recipients yet — add at least one to enable auto-delivery.</div>
        ) : (
          <ul className="flex flex-wrap gap-2" data-testid="delivery-recipients-list">
            {local.recipients.map((email) => (
              <li key={email} data-testid={`delivery-recipient-${email}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-brand-border text-xs font-body text-brand-text">
                <Mail size={10} className="text-brand-primary" /> {email}
                <button onClick={() => removeRecipient(email)} className="text-brand-text-secondary hover:text-red-600" aria-label={`Remove ${email}`}>
                  <X size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
