import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Save, ArrowUpRight, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

const API = "/api";

const TRIGGER_OPTIONS = [
  { value: "on_placement", label: "On order placement", desc: "Queue kitchen tickets the moment a customer's payment is confirmed." },
  { value: "on_acceptance", label: "On order acceptance", desc: "Queue kitchen tickets only when an admin clicks Accept (recommended)." },
  { value: "off", label: "Off (manual only)", desc: "Tickets are never queued automatically — reprint manually from Orders." },
];

export default function AdminPrintSettings() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [kds, setKds] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [{ data: s }, { data: k }] = await Promise.all([
        axios.get(`${API}/admin/print-settings`, { withCredentials: true }),
        axios.get(`${API}/admin/kds/settings`, { withCredentials: true }),
      ]);
      setSettings(s); setKds(k);
    } catch { toast.error("Could not load settings"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await axios.patch(`${API}/admin/print-settings`, {
        auto_trigger: settings.auto_trigger,
        auto_receipt: settings.auto_receipt,
      }, { withCredentials: true });
      setSettings(data); toast.success("Print settings saved");
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  if (loading || !settings) return <div className="py-20 flex justify-center"><Loader2 size={28} className="animate-spin text-brand-primary" /></div>;

  const routing = kds?.station_routing || {};
  const stations = Object.keys(routing);

  return (
    <div data-testid="admin-print-settings" className="p-6 sm:p-10 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-brand-text">Print Settings</h1>
        <p className="font-body text-sm text-brand-text-secondary mt-1">Decide when kitchen tickets auto-print and how receipts behave.</p>
      </div>

      {/* Auto-trigger */}
      <section className="bg-white border border-brand-border rounded-xl p-5 mb-4">
        <h2 className="font-heading text-base font-bold text-brand-text mb-3">Auto-print trigger</h2>
        <div className="space-y-3">
          {TRIGGER_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              data-testid={`trigger-option-${opt.value}`}
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition ${settings.auto_trigger === opt.value ? "border-brand-primary bg-brand-primary/5" : "border-brand-border hover:border-brand-primary/40"}`}
            >
              <input
                type="radio"
                name="auto_trigger"
                value={opt.value}
                checked={settings.auto_trigger === opt.value}
                onChange={() => setSettings((s) => ({ ...s, auto_trigger: opt.value }))}
                className="mt-0.5 accent-brand-primary"
              />
              <div>
                <div className="font-body text-sm font-semibold text-brand-text">{opt.label}</div>
                <div className="font-body text-xs text-brand-text-secondary mt-0.5">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Receipt */}
      <section className="bg-white border border-brand-border rounded-xl p-5 mb-4">
        <h2 className="font-heading text-base font-bold text-brand-text mb-3">Customer receipts</h2>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-body text-sm font-semibold text-brand-text">Queue a receipt with each auto-triggered order</div>
            <div className="font-body text-xs text-brand-text-secondary mt-0.5">Receipts are sent to the first online printer with station <span className="font-semibold">receipt</span>.</div>
          </div>
          <Switch
            data-testid="auto-receipt-switch"
            checked={!!settings.auto_receipt}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, auto_receipt: v }))}
          />
        </div>
      </section>

      {/* Routing info */}
      <section className="bg-white border border-brand-border rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="font-heading text-base font-bold text-brand-text">Station routing</h2>
            <p className="font-body text-xs text-brand-text-secondary mt-0.5">We reuse your KDS station routing to pick which printers get which items.</p>
          </div>
          <Link to="/admin/kds-settings" className="inline-flex items-center gap-1 text-xs text-brand-primary font-semibold" data-testid="edit-routing-link">
            Edit routing <ArrowUpRight size={12} />
          </Link>
        </div>
        {stations.length === 0 ? (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
            <Info size={14} className="mt-0.5 flex-shrink-0" /> No stations configured yet. Set routing on the KDS page so tickets reach the right printers.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {stations.map((st) => (
              <div key={st} data-testid={`station-summary-${st}`} className="border border-brand-border rounded-lg p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-brand-primary">{st}</div>
                <div className="text-xs text-brand-text-secondary mt-1">{(routing[st] || []).join(", ") || "(no categories)"}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} data-testid="save-print-settings-btn">
          <Save size={14} className="mr-1" /> {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
