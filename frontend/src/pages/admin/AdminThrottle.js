import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Save, Gauge, Zap, Pause, Play, Plus, Trash2, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const API = "/api";

const CAP_STATE_META = {
  normal: { label: "Normal", cls: "bg-green-100 text-green-700 border-green-200" },
  busy: { label: "Busy", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  at_capacity: { label: "At capacity", cls: "bg-red-100 text-red-700 border-red-200" },
  paused: { label: "Paused", cls: "bg-gray-200 text-gray-700 border-gray-300" },
};

export default function AdminThrottle() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(null);
  const [prep, setPrep] = useState({});
  const [newCat, setNewCat] = useState("");

  const loadAll = async () => {
    try {
      const [s, st, p] = await Promise.all([
        axios.get(`${API}/admin/throttle/settings`, { withCredentials: true }),
        axios.get(`${API}/admin/throttle/status`, { withCredentials: true }),
        axios.get(`${API}/admin/prep-times`, { withCredentials: true }),
      ]);
      setSettings(s.data); setStatus(st.data);
      setPrep(p.data.target_prep_minutes_by_category || {});
    } catch { toast.error("Could not load throttle data"); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    loadAll();
    const t = setInterval(async () => {
      try { const { data } = await axios.get(`${API}/admin/throttle/status`, { withCredentials: true }); setStatus(data); }
      catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        max_concurrent_orders: settings.max_concurrent_orders,
        auto_pause_threshold: settings.auto_pause_threshold,
        slot_granularity_minutes: settings.slot_granularity_minutes,
        base_buffer_minutes: settings.base_buffer_minutes,
      };
      await axios.patch(`${API}/admin/throttle/settings`, body, { withCredentials: true });
      await axios.put(`${API}/admin/prep-times`, { target_prep_minutes_by_category: prep }, { withCredentials: true });
      toast.success("Saved");
      loadAll();
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const togglePause = async () => {
    try {
      const { data } = await axios.post(`${API}/admin/store/pause`, {}, { withCredentials: true });
      toast.success(data.pause_ordering ? "Ordering paused" : "Ordering resumed");
      loadAll();
    } catch { toast.error("Could not toggle pause"); }
  };

  const updatePrep = (cat, val) => setPrep((p) => ({ ...p, [cat]: Math.max(1, parseInt(val || "1", 10)) }));
  const removePrep = (cat) => setPrep((p) => { const n = { ...p }; delete n[cat]; return n; });
  const addPrep = () => {
    const c = newCat.trim().toLowerCase();
    if (!c || prep[c] !== undefined) return;
    setPrep((p) => ({ ...p, [c]: 10 }));
    setNewCat("");
  };

  const meta = useMemo(() => CAP_STATE_META[status?.state] || CAP_STATE_META.normal, [status]);
  const pct = status ? Math.round(Math.min(status.utilization, 1) * 100) : 0;
  const barColor = status?.state === "at_capacity" ? "bg-red-500"
    : status?.state === "busy" ? "bg-amber-500"
    : status?.state === "paused" ? "bg-gray-400"
    : "bg-green-500";

  if (loading || !settings) return <div className="py-20 flex justify-center"><Loader2 size={28} className="animate-spin text-brand-primary" /></div>;

  return (
    <div data-testid="admin-throttle-page" className="p-6 sm:p-10 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-brand-text">Prep Times & Throttling</h1>
        <p className="font-body text-sm text-brand-text-secondary mt-1">Control how fast your kitchen can breathe. Customers see live ETAs based on these settings.</p>
      </div>

      {/* Live status */}
      <section className="bg-white border border-brand-border rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <Gauge size={16} className="text-brand-primary" />
            <h2 className="font-heading text-base font-bold text-brand-text">Live load</h2>
          </div>
          <span data-testid="throttle-state-badge" className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${meta.cls}`}>
            {status?.state === "paused" && <Pause size={12} />}
            {status?.state === "at_capacity" && <Zap size={12} />}
            {meta.label}
          </span>
        </div>
        <div className="flex items-baseline gap-3 mb-2" data-testid="throttle-load">
          <span className="font-heading text-3xl font-bold text-brand-text">{status.active_count}</span>
          <span className="text-brand-text-secondary text-sm">/ {status.max_concurrent_orders} active orders</span>
          <span className="ml-auto text-sm font-semibold text-brand-text-secondary">{pct}%</span>
        </div>
        <div className="h-3 bg-brand-surface rounded-full overflow-hidden">
          <div className={`${barColor} h-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            data-testid="toggle-pause-btn"
            onClick={togglePause}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition ${status.paused ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`}
          >
            {status.paused ? <><Play size={14} /> Resume ordering</> : <><Pause size={14} /> Pause ordering</>}
          </button>
          {status.auto_pause_threshold > 0 && (
            <span className="text-xs text-brand-text-secondary">Auto-pause at {status.auto_pause_threshold} active orders</span>
          )}
        </div>
      </section>

      {/* Throttle config */}
      <section className="bg-white border border-brand-border rounded-xl p-5 mb-5">
        <h2 className="font-heading text-base font-bold text-brand-text mb-3">Capacity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-brand-text-secondary uppercase tracking-wider">Max concurrent orders</label>
            <input
              data-testid="max-concurrent-input"
              type="number" min={1}
              value={settings.max_concurrent_orders}
              onChange={(e) => setSettings((s) => ({ ...s, max_concurrent_orders: parseInt(e.target.value || "1", 10) }))}
              className="w-full mt-1 px-3 py-2 border border-brand-border rounded-md text-sm"
            />
            <div className="text-[10px] text-brand-text-secondary mt-1">Above this, customers see "Busy" / "At capacity"</div>
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-text-secondary uppercase tracking-wider">Auto-pause threshold</label>
            <input
              data-testid="auto-pause-input"
              type="number" min={0}
              value={settings.auto_pause_threshold}
              onChange={(e) => setSettings((s) => ({ ...s, auto_pause_threshold: parseInt(e.target.value || "0", 10) }))}
              className="w-full mt-1 px-3 py-2 border border-brand-border rounded-md text-sm"
            />
            <div className="text-[10px] text-brand-text-secondary mt-1">0 = disabled. Otherwise flips pause on when active orders ≥ this.</div>
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-text-secondary uppercase tracking-wider">Slot granularity</label>
            <select
              data-testid="slot-granularity-select"
              value={settings.slot_granularity_minutes}
              onChange={(e) => setSettings((s) => ({ ...s, slot_granularity_minutes: parseInt(e.target.value, 10) }))}
              className="w-full mt-1 px-3 py-2 border border-brand-border rounded-md text-sm bg-white"
            >
              {[5, 10, 15, 30, 60].map((v) => <option key={v} value={v}>{v} min</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-text-secondary uppercase tracking-wider">Base queue buffer (min)</label>
            <input
              data-testid="base-buffer-input"
              type="number" min={0}
              value={settings.base_buffer_minutes}
              onChange={(e) => setSettings((s) => ({ ...s, base_buffer_minutes: parseInt(e.target.value || "0", 10) }))}
              className="w-full mt-1 px-3 py-2 border border-brand-border rounded-md text-sm"
            />
          </div>
        </div>
      </section>

      {/* Prep times */}
      <section className="bg-white border border-brand-border rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2">
            <Clock size={16} className="text-brand-primary" /> Prep times by category
          </h2>
          <div className="flex items-center gap-1.5">
            <input
              data-testid="new-category-input"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="add a category"
              className="px-2.5 py-1 border border-brand-border rounded-md text-xs"
            />
            <button onClick={addPrep} data-testid="add-category-btn" className="inline-flex items-center gap-1 px-2 py-1 bg-brand-primary text-white text-xs font-semibold rounded-md hover:bg-brand-primary-hover"><Plus size={12} /></button>
          </div>
        </div>
        <div className="divide-y divide-brand-border">
          {Object.keys(prep).sort().map((cat) => (
            <div key={cat} data-testid={`prep-row-${cat}`} className="flex items-center justify-between py-2">
              <span className="capitalize font-body text-sm font-semibold text-brand-text">{cat}</span>
              <div className="flex items-center gap-2">
                <input
                  data-testid={`prep-input-${cat}`}
                  type="number" min={1}
                  value={prep[cat]}
                  onChange={(e) => updatePrep(cat, e.target.value)}
                  className="w-20 px-2 py-1 border border-brand-border rounded-md text-sm text-right"
                />
                <span className="text-xs text-brand-text-secondary">min</span>
                <button onClick={() => removePrep(cat)} data-testid={`prep-remove-${cat}`} className="text-red-600 hover:text-red-700 p-1"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
          {Object.keys(prep).length === 0 && <div className="text-xs text-brand-text-secondary italic py-3">No categories yet — add one above.</div>}
        </div>
      </section>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} data-testid="save-throttle-btn" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white font-semibold text-sm rounded-full hover:bg-brand-primary-hover disabled:opacity-50">
          <Save size={14} /> {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
