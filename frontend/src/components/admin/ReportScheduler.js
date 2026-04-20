import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Mail, Plus, Trash2, Send, Calendar, Loader2, Power, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const API = "/api";

const TYPES = [
  { v: "orders", label: "Orders" },
  { v: "revenue", label: "Revenue" },
  { v: "items", label: "Items sold" },
];
const FREQ = [
  { v: "daily", label: "Daily" },
  { v: "weekly", label: "Weekly" },
  { v: "monthly", label: "Monthly" },
];

function formatDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function ReportScheduler() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ report_type: "revenue", frequency: "weekly", email: "" });
  const [creating, setCreating] = useState(false);

  const load = () => axios.get(`${API}/admin/reports/schedules`, { withCredentials: true })
    .then(({ data }) => setItems(data.schedules || []))
    .catch(() => toast.error("Could not load schedules"))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) {
      toast.error("Enter a valid email");
      return;
    }
    setCreating(true);
    try {
      await axios.post(`${API}/admin/reports/schedules`, form, { withCredentials: true });
      setForm({ ...form, email: "" });
      await load();
      toast.success("Schedule created");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not create schedule");
    } finally { setCreating(false); }
  };

  const toggle = async (s) => {
    try {
      await axios.patch(`${API}/admin/reports/schedules/${s.id}`, { enabled: !s.enabled }, { withCredentials: true });
      load();
    } catch { toast.error("Update failed"); }
  };

  const remove = async (s) => {
    if (!window.confirm(`Delete schedule for ${s.email}?`)) return;
    try {
      await axios.delete(`${API}/admin/reports/schedules/${s.id}`, { withCredentials: true });
      load();
      toast.success("Schedule removed");
    } catch { toast.error("Delete failed"); }
  };

  const sendNow = async (s) => {
    try {
      const { data } = await axios.post(`${API}/admin/reports/schedules/${s.id}/send-now`, {}, { withCredentials: true });
      load();
      toast.success(`Report queued · ${data.row_count} rows → ${data.email}`, {
        description: "Email delivery is simulated in this environment.",
      });
    } catch { toast.error("Send failed"); }
  };

  return (
    <section data-testid="report-scheduler" className="bg-white border border-brand-border rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2">
          <Calendar size={16} className="text-brand-primary" /> Scheduled reports
        </h2>
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-body font-bold uppercase tracking-wider">
          <Info size={10} /> Email delivery MOCKED
        </span>
      </div>

      <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4" data-testid="schedule-create-form">
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Report</Label>
          <select data-testid="schedule-type-select" value={form.report_type} onChange={(e) => setForm({ ...form, report_type: e.target.value })} className="w-full h-9 rounded-md border border-brand-border bg-white text-sm px-2">
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Frequency</Label>
          <select data-testid="schedule-freq-select" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full h-9 rounded-md border border-brand-border bg-white text-sm px-2">
            {FREQ.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Email</Label>
          <Input data-testid="schedule-email-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="owner@example.com" className="h-9" />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            data-testid="schedule-create-btn"
            disabled={creating}
            className="w-full inline-flex items-center justify-center gap-1.5 h-9 px-4 bg-brand-primary text-white font-body text-sm font-semibold rounded-md hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Create
          </button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-brand-primary" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-sm text-brand-text-secondary" data-testid="schedule-empty">
          No schedules yet. Set up one above to receive reports in your inbox.
        </div>
      ) : (
        <ul className="divide-y divide-brand-border border border-brand-border rounded-lg overflow-hidden" data-testid="schedule-list">
          {items.map((s) => (
            <li key={s.id} data-testid={`schedule-row-${s.id}`} className="flex items-center gap-3 px-3 py-2.5 bg-white">
              <div className="w-9 h-9 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0">
                <Mail size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading text-sm font-bold text-brand-text capitalize">{s.report_type}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-bg text-brand-text-secondary font-semibold uppercase tracking-wider">{s.frequency}</span>
                  {!s.enabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-text-secondary/10 text-brand-text-secondary font-semibold uppercase tracking-wider">Paused</span>}
                </div>
                <div className="text-[11px] text-brand-text-secondary mt-0.5 truncate">
                  {s.email} · next: {formatDate(s.next_send_at)}
                  {s.last_sent_at && <> · last sent: {formatDate(s.last_sent_at)} ({s.last_row_count || 0} rows)</>}
                </div>
              </div>
              <button
                data-testid={`schedule-toggle-${s.id}`}
                onClick={() => toggle(s)}
                className="p-1.5 rounded-md text-brand-text-secondary hover:bg-brand-bg"
                aria-label={s.enabled ? "Pause" : "Enable"}
                title={s.enabled ? "Pause" : "Enable"}
              >
                <Power size={14} className={s.enabled ? "text-green-600" : ""} />
              </button>
              <Switch
                data-testid={`schedule-switch-${s.id}`}
                checked={!!s.enabled}
                onCheckedChange={() => toggle(s)}
              />
              <button
                data-testid={`schedule-send-now-${s.id}`}
                onClick={() => sendNow(s)}
                className="inline-flex items-center gap-1 px-2.5 py-1 border border-brand-border rounded-md text-[11px] font-semibold hover:border-brand-primary/50 hover:text-brand-primary"
                title="Send now"
              >
                <Send size={11} /> Send now
              </button>
              <button
                data-testid={`schedule-delete-${s.id}`}
                onClick={() => remove(s)}
                className="p-1.5 rounded-md text-brand-text-secondary hover:text-red-600 hover:bg-red-50"
                aria-label="Delete"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
