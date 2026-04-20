import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Save, RefreshCw, Shield, Clock, Percent, XCircle, Users, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API = "/api";

const REASON_LABELS = {
  changed_mind: "Changed my mind",
  mistake: "Ordered by mistake",
  too_long: "Taking too long",
  other: "Other",
  admin_action: "Admin cancelled",
  unknown: "Unknown",
};

export default function AdminCancellations() {
  const [config, setConfig] = useState(null);
  const [original, setOriginal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try {
      const [c, l] = await Promise.all([
        axios.get(`${API}/admin/cancellation/config`, { withCredentials: true }),
        axios.get(`${API}/admin/cancellations`, { withCredentials: true }),
      ]);
      setConfig(c.data);
      setOriginal(JSON.parse(JSON.stringify(c.data)));
      setList(l.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to load");
    } finally { setLoading(false); }
  }

  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(original), [config, original]);

  async function save() {
    setSaving(true);
    try {
      await axios.patch(`${API}/admin/cancellation/config`, {
        window_minutes: Number(config.window_minutes),
        customer_self_cancel_enabled: config.customer_self_cancel_enabled,
        auto_refund: config.auto_refund,
        require_reason: config.require_reason,
        notify_customer_on_modification: config.notify_customer_on_modification,
      }, { withCredentials: true });
      toast.success("Configuration saved");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  }

  if (loading || !config || !list) {
    return <div data-testid="cancellations-loading" className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-brand-primary" /></div>;
  }

  const totalCount = list.orders.length;

  return (
    <div data-testid="admin-cancellations-page" className="p-6 lg:p-10 max-w-6xl">
      <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 data-testid="cancellations-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">Cancellations &amp; Refunds</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">Set the customer self-cancel window, refund policy, and review recent cancellations.</p>
        </div>
        <button data-testid="cancellations-refresh-btn" onClick={load} className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text-secondary font-body text-sm font-medium rounded-full hover:bg-brand-surface"><RefreshCw size={14} /> Refresh</button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
        {/* Config card */}
        <section className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-5">
          <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2"><Shield size={16} className="text-brand-primary" /> Policy</h2>

          <ToggleRow
            title="Allow customers to cancel their own order"
            subtitle="Customers will see a Cancel button during the window below."
            checked={config.customer_self_cancel_enabled}
            onCheckedChange={(v) => setConfig({ ...config, customer_self_cancel_enabled: v })}
            testId="cfg-self-cancel-switch"
          />

          <div>
            <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold inline-flex items-center gap-1.5"><Clock size={12} /> Cancellation window (minutes)</Label>
            <Input
              data-testid="cfg-window-input"
              type="number"
              min={0}
              max={120}
              value={config.window_minutes}
              onChange={(e) => setConfig({ ...config, window_minutes: e.target.value })}
              className="mt-1.5 max-w-32"
            />
            <p className="text-[11px] text-brand-text-secondary mt-1">Applies from the moment the order is placed. 0 disables the button.</p>
          </div>

          <ToggleRow
            title="Auto-refund on cancel"
            subtitle={<span>If off, staff must manually approve each refund. <span className="text-[10px] uppercase tracking-wider text-brand-primary font-bold ml-1">MOCKED</span> — no live payment provider call.</span>}
            checked={config.auto_refund}
            onCheckedChange={(v) => setConfig({ ...config, auto_refund: v })}
            testId="cfg-auto-refund-switch"
          />

          <ToggleRow
            title="Require a reason when cancelling"
            subtitle="Customers must pick one of 4 pre-set reasons."
            checked={config.require_reason}
            onCheckedChange={(v) => setConfig({ ...config, require_reason: v })}
            testId="cfg-require-reason-switch"
          />

          <ToggleRow
            title="Notify customer on price modification"
            subtitle="Shows a banner on the tracking page when an admin changes the total."
            checked={config.notify_customer_on_modification}
            onCheckedChange={(v) => setConfig({ ...config, notify_customer_on_modification: v })}
            testId="cfg-notify-modification-switch"
          />

          <div className="pt-2">
            <button
              data-testid="cfg-save-btn"
              onClick={save}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {dirty ? "Save policy" : "Saved"}
            </button>
          </div>
        </section>

        {/* KPIs + reasons */}
        <section className="space-y-4">
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
            <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2 mb-4"><Percent size={16} className="text-brand-primary" /> Reason breakdown · last {totalCount} cancelled</h2>
            {totalCount === 0 ? (
              <div data-testid="cancellations-breakdown-empty" className="text-sm text-brand-text-secondary italic">No cancellations yet. Customers who cancel will show up here.</div>
            ) : (
              <div className="space-y-2">
                {Object.entries(list.breakdown).sort((a, b) => b[1] - a[1]).map(([code, n]) => (
                  <div key={code} data-testid={`breakdown-${code}`} className="flex items-center gap-3">
                    <div className="w-32 text-xs font-body font-semibold text-brand-text">{REASON_LABELS[code] || code}</div>
                    <div className="flex-1 h-2 bg-brand-bg rounded-full overflow-hidden">
                      <div className="h-full bg-brand-primary" style={{ width: `${(n / totalCount) * 100}%` }} />
                    </div>
                    <div className="w-8 text-right text-xs font-body text-brand-text-secondary">{n}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Recent cancellations table */}
      <section className="mt-8 bg-brand-surface border border-brand-border rounded-2xl overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
          <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2"><XCircle size={16} className="text-brand-primary" /> Recent cancellations · {totalCount}</h2>
        </header>
        {totalCount === 0 ? (
          <div data-testid="cancellations-list-empty" className="p-10 text-center text-sm font-body text-brand-text-secondary italic">No cancellations yet.</div>
        ) : (
          <table className="w-full text-sm font-body">
            <thead className="bg-brand-bg text-left">
              <tr>
                <th className="p-3 text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Order</th>
                <th className="p-3 text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Customer</th>
                <th className="p-3 text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Cancelled</th>
                <th className="p-3 text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Reason</th>
                <th className="p-3 text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">By</th>
                <th className="p-3 text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Refund</th>
                <th className="p-3 text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {list.orders.map((o) => (
                <tr key={o.id} data-testid={`cancellation-row-${o.id}`} className="border-t border-brand-border">
                  <td className="p-3 font-mono text-xs">{o.order_number}</td>
                  <td className="p-3 text-xs">{o.contact_name || o.contact_email || "—"}</td>
                  <td className="p-3 text-xs whitespace-nowrap">{o.cancelled_at ? new Date(o.cancelled_at).toLocaleString() : "—"}</td>
                  <td className="p-3 text-xs">{REASON_LABELS[o.cancellation_reason_code] || o.cancellation_reason_code || "—"}</td>
                  <td className="p-3 text-xs capitalize">{o.cancelled_by || "—"}</td>
                  <td className="p-3 text-xs">
                    {o.payment_status === "refunded" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold">Refunded ${Number(o.total || 0).toFixed(2)}</span>
                    ) : o.refund_pending ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold"><AlertTriangle size={10} /> Pending</span>
                    ) : (
                      <span className="text-brand-text-secondary">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <Link to={`/orders/track/${o.id}`} className="text-xs text-brand-primary hover:underline" data-testid={`cancellation-view-${o.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function ToggleRow({ title, subtitle, checked, onCheckedChange, testId }) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-brand-border bg-brand-bg">
      <div>
        <div className="font-body text-sm font-semibold text-brand-text">{title}</div>
        <div className="text-[11px] text-brand-text-secondary mt-0.5">{subtitle}</div>
      </div>
      <Switch data-testid={testId} checked={!!checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
