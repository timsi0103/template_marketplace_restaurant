import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Save, Power, AlertTriangle, CalendarOff, Calendar, Plus, Trash2, Info, Clock, RefreshCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

const API = "/api";
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const SHORT = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };
const SERVICES = [
  { key: "delivery", label: "Delivery" },
  { key: "pickup", label: "Pickup" },
  { key: "dine_in", label: "Dine-In" },
];
const DEFAULT_SVC = { open_time: "10:00", close_time: "22:00", closed: false };


export default function AdminHours() {
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState({});
  const [pauseState, setPauseState] = useState({ pause_ordering: false, pause_reason: "", pause_until: null });
  const [advance, setAdvance] = useState({ accept_advance_orders: true, max_days_ahead: 7 });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);

  // Load everything
  const loadAll = async () => {
    setLoading(true);
    try {
      const [h, adv] = await Promise.all([
        axios.get(`${API}/admin/store/hours`, { withCredentials: true }),
        axios.get(`${API}/admin/store/advance-orders`, { withCredentials: true }),
      ]);
      setHours(h.data.hours || {});
      setPauseState({
        pause_ordering: h.data.pause_ordering || false,
        pause_reason: h.data.pause_reason || "",
        pause_until: h.data.pause_until || null,
      });
      setAdvance(adv.data);
      setDirty(false);
    } catch {
      toast.error("Could not load hours");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadAll(); }, []);

  const updateCell = (day, svc, field, value) => {
    setHours((prev) => {
      const d = { ...(prev[day] || {}) };
      d[svc] = { ...(d[svc] || { ...DEFAULT_SVC }), [field]: value };
      return { ...prev, [day]: d };
    });
    setDirty(true);
  };

  const copyRow = (day, fromSvc, toSvc) => {
    setHours((prev) => {
      const d = { ...(prev[day] || {}) };
      d[toSvc] = { ...(d[fromSvc] || { ...DEFAULT_SVC }) };
      return { ...prev, [day]: d };
    });
    setDirty(true);
  };

  const applyToAllDays = (svc) => {
    const source = hours.monday?.[svc] || { ...DEFAULT_SVC };
    setHours((prev) => {
      const next = { ...prev };
      for (const d of DAYS) {
        next[d] = { ...(next[d] || {}), [svc]: { ...source } };
      }
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/store/hours`, { hours }, { withCredentials: true });
      setDirty(false);
      toast.success("Hours saved — live on storefront");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const updatePause = async (paused, reason, estimated_reopen) => {
    try {
      const { data } = await axios.post(`${API}/admin/store/pause`,
        { paused, reason, estimated_reopen },
        { withCredentials: true }
      );
      setPauseState(data);
      toast.success(paused ? "Ordering paused" : "Ordering resumed");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Pause toggle failed");
    }
  };

  const saveAdvance = async (patch) => {
    try {
      const { data } = await axios.patch(`${API}/admin/store/advance-orders`, patch, { withCredentials: true });
      setAdvance(data);
      toast.success("Advance-orders updated");
    } catch { toast.error("Update failed"); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-brand-primary" /></div>;

  return (
    <div data-testid="admin-hours-page" className="p-6 lg:p-10 max-w-6xl space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 data-testid="hours-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">Hours & availability</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">
            Weekly schedule, holidays, emergency pause, and special-day overrides.
          </p>
        </div>
        <button
          data-testid="save-hours-btn"
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-primary text-white text-sm font-body font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {dirty ? "Save weekly schedule" : "Saved"}
        </button>
      </div>

      <PauseCard state={pauseState} onOpen={() => setPauseDialogOpen(true)} onResume={() => updatePause(false)} />

      <WeeklyGrid hours={hours} onCell={updateCell} onCopyDayRow={copyRow} onApplyAll={applyToAllDays} />

      <OverviewCard />

      <HolidaysSection />

      <SpecialHoursSection />

      <AdvanceOrdersCard advance={advance} onSave={saveAdvance} />

      <PauseDialog open={pauseDialogOpen} onClose={() => setPauseDialogOpen(false)} onConfirm={(r, eta) => {
        setPauseDialogOpen(false);
        updatePause(true, r, eta);
      }} />
    </div>
  );
}


/* ──── Pause card ───────────────────────────────── */
function PauseCard({ state, onOpen, onResume }) {
  const paused = state.pause_ordering;
  return (
    <section data-testid="pause-card" className={`rounded-2xl border p-5 ${paused ? "bg-red-50 border-red-300" : "bg-brand-surface border-brand-border"}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${paused ? "bg-red-600 text-white" : "bg-brand-bg text-brand-primary"}`}>
            {paused ? <CalendarOff size={18} /> : <Power size={18} />}
          </div>
          <div>
            <h2 className={`font-heading text-lg font-bold ${paused ? "text-red-800" : "text-brand-text"}`}>
              {paused ? "Ordering is PAUSED" : "Ordering is live"}
            </h2>
            {paused ? (
              <>
                {state.pause_reason && <p className="font-body text-sm text-red-900 mt-1" data-testid="pause-state-reason">{state.pause_reason}</p>}
                {state.pause_until && (
                  <p className="text-xs text-red-900/80 mt-0.5" data-testid="pause-state-until">
                    Estimated reopen: {new Date(state.pause_until).toLocaleString()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-brand-text-secondary mt-1">
                Emergency toggle to stop all incoming orders immediately (kitchen fire, staff shortage, etc.).
              </p>
            )}
          </div>
        </div>
        {paused ? (
          <button data-testid="resume-ordering-btn" onClick={onResume} className="inline-flex items-center gap-1.5 px-5 py-2 bg-green-600 text-white rounded-full text-sm font-body font-semibold hover:bg-green-700">
            <Power size={14} /> Resume ordering
          </button>
        ) : (
          <button data-testid="open-pause-dialog-btn" onClick={onOpen} className="inline-flex items-center gap-1.5 px-5 py-2 bg-red-600 text-white rounded-full text-sm font-body font-semibold hover:bg-red-700">
            <AlertTriangle size={14} /> Pause ordering
          </button>
        )}
      </div>
    </section>
  );
}

function PauseDialog({ open, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [etaDate, setEtaDate] = useState("");
  const [etaTime, setEtaTime] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      const now = new Date();
      const plus2 = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      setEtaDate(plus2.toISOString().slice(0, 10));
      setEtaTime(plus2.toTimeString().slice(0, 5));
    }
  }, [open]);

  const etaIso = etaDate && etaTime ? new Date(`${etaDate}T${etaTime}:00`).toISOString() : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-testid="pause-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl text-brand-text">Pause ordering</DialogTitle>
          <DialogDescription>
            Customers will see a clear "we're temporarily unavailable" message with your reason and estimated reopen time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Reason (shown to customers)</Label>
            <Textarea data-testid="pause-reason-input" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Kitchen flood — back in a couple of hours." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Reopen date</Label>
              <Input data-testid="pause-eta-date" type="date" value={etaDate} onChange={(e) => setEtaDate(e.target.value)} />
            </div>
            <div>
              <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Reopen time</Label>
              <Input data-testid="pause-eta-time" type="time" value={etaTime} onChange={(e) => setEtaTime(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-brand-border rounded-full text-sm font-body font-semibold">Cancel</button>
          <button
            data-testid="pause-confirm-btn"
            onClick={() => onConfirm(reason.trim(), etaIso)}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-red-600 text-white rounded-full text-sm font-body font-semibold hover:bg-red-700"
          >
            <AlertTriangle size={14} /> Pause now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


/* ──── Weekly grid ──────────────────────────────── */
function WeeklyGrid({ hours, onCell, onCopyDayRow, onApplyAll }) {
  return (
    <section data-testid="weekly-grid-section" className="bg-brand-surface border border-brand-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-border flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2">
            <Clock size={16} className="text-brand-primary" /> Weekly schedule
          </h2>
          <p className="font-body text-xs text-brand-text-secondary mt-0.5">Three schedules side-by-side — delivery, pickup, dine-in. Close a service on a specific day with its toggle.</p>
        </div>
        <div className="flex gap-2">
          {SERVICES.map((s) => (
            <button
              key={s.key}
              data-testid={`apply-all-${s.key}`}
              onClick={() => onApplyAll(s.key)}
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border border-brand-border hover:border-brand-primary/50 text-brand-text-secondary hover:text-brand-primary"
              title={`Copy Monday ${s.label} hours to all days`}
            >
              <RefreshCcw size={10} /> Apply {s.label} to all
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="overflow-x-auto -mx-6 px-6"><table className="w-full text-sm min-w-[640px]">
          <thead className="bg-brand-bg/60">
            <tr>
              <th className="p-3 text-left text-[10px] uppercase tracking-widest text-brand-text-secondary font-semibold w-24">Day</th>
              {SERVICES.map((s) => (
                <th key={s.key} className="p-3 text-left text-[10px] uppercase tracking-widest text-brand-text-secondary font-semibold">{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => (
              <tr key={day} data-testid={`hours-row-${day}`} className="border-t border-brand-border align-middle">
                <td className="p-3 font-heading font-bold text-brand-text capitalize">
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{SHORT[day]}</span>
                </td>
                {SERVICES.map((s) => {
                  const svc = hours[day]?.[s.key] || DEFAULT_SVC;
                  const closed = svc.closed;
                  return (
                    <td key={s.key} className={`p-2 ${closed ? "bg-brand-bg/40" : ""}`}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Input
                          data-testid={`${s.key}-open-${day}`}
                          type="time"
                          disabled={closed}
                          value={svc.open_time}
                          onChange={(e) => onCell(day, s.key, "open_time", e.target.value)}
                          className="h-9 w-[112px] px-2 bg-brand-bg border-brand-border tabular-nums"
                        />
                        <span className="text-xs text-brand-text-secondary">–</span>
                        <Input
                          data-testid={`${s.key}-close-${day}`}
                          type="time"
                          disabled={closed}
                          value={svc.close_time}
                          onChange={(e) => onCell(day, s.key, "close_time", e.target.value)}
                          className="h-9 w-[112px] px-2 bg-brand-bg border-brand-border tabular-nums"
                        />
                        <Switch
                          data-testid={`${s.key}-open-toggle-${day}`}
                          checked={!closed}
                          onCheckedChange={(v) => onCell(day, s.key, "closed", !v)}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </section>
  );
}


/* ──── Hours Overview (next 7 days + conflicts) ───── */
function OverviewCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = () => axios.get(`${API}/admin/store/overview`, { withCredentials: true })
    .then(({ data }) => setData(data))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  return (
    <section data-testid="overview-section" className="bg-brand-surface border border-brand-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2">
          <Calendar size={16} className="text-brand-primary" /> Next 7 days overview
        </h2>
        <button data-testid="overview-refresh" onClick={load} className="text-[11px] inline-flex items-center gap-1 text-brand-text-secondary hover:text-brand-primary">
          <RefreshCcw size={11} /> Refresh
        </button>
      </div>
      {loading || !data ? (
        <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-brand-primary" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="overview-table">
            <thead>
              <tr className="text-left text-brand-text-secondary uppercase tracking-wider text-[10px]">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 px-3">Delivery</th>
                <th className="py-2 px-3">Pickup</th>
                <th className="py-2 px-3">Dine-In</th>
                <th className="py-2 px-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((d) => {
                const hol = d.holiday;
                const sp = d.special;
                return (
                  <tr key={d.date} data-testid={`overview-row-${d.date}`} className={`border-t border-brand-border ${hol ? "bg-red-50/60" : sp ? "bg-amber-50" : ""}`}>
                    <td className="py-2 pr-3 font-body">
                      <div className="font-heading font-semibold text-brand-text">{d.day_name.charAt(0).toUpperCase() + d.day_name.slice(1, 3)} · {d.date.slice(5)}</div>
                      {d.is_today && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary font-bold uppercase tracking-wider">Today</span>}
                    </td>
                    {["delivery", "pickup", "dine_in"].map((svc) => {
                      const s = d.services[svc] || {};
                      return (
                        <td key={svc} className="py-2 px-3">
                          {hol ? (
                            <span className="text-red-700 font-semibold">Closed (holiday)</span>
                          ) : s.closed ? (
                            <span className="text-brand-text-secondary">Closed</span>
                          ) : (
                            <span className="text-brand-text">{s.open_time} – {s.close_time}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3">
                      {hol && <span data-testid={`overview-holiday-${d.date}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider">Holiday · {hol.reason}</span>}
                      {sp && <span data-testid={`overview-special-${d.date}`} className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">Special · {sp.label || "override"}</span>}
                      {d.conflicts?.map((c) => (
                        <span key={c.service} data-testid={`overview-conflict-${d.date}`} className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold" title={c.message}>
                          <AlertTriangle size={10} /> Conflict: {c.service}
                        </span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}


/* ──── Holidays ──────────────────────────────────── */
function HolidaysSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: "", reason: "", message: "", all_day: true });

  const load = () => axios.get(`${API}/admin/store/holidays`, { withCredentials: true })
    .then(({ data }) => setItems(data.holidays || []))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!form.date) return;
    try {
      await axios.post(`${API}/admin/store/holidays`, form, { withCredentials: true });
      setForm({ date: "", reason: "", message: "", all_day: true });
      toast.success("Holiday added");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Add failed"); }
  };
  const remove = async (h) => {
    if (!window.confirm(`Remove "${h.reason || h.date}"?`)) return;
    await axios.delete(`${API}/admin/store/holidays/${h.id}`, { withCredentials: true });
    toast.success("Holiday removed"); load();
  };

  return (
    <section data-testid="holidays-section" className="bg-brand-surface border border-brand-border rounded-2xl p-5">
      <h2 className="font-heading text-base font-bold text-brand-text mb-1 inline-flex items-center gap-2">
        <CalendarOff size={16} className="text-brand-primary" /> Holiday closures
      </h2>
      <p className="font-body text-xs text-brand-text-secondary mb-4">Mark specific dates closed with a custom message shown to guests.</p>

      <form onSubmit={add} data-testid="holiday-form" className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Date</Label>
          <Input data-testid="holiday-date-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        </div>
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Reason</Label>
          <Input data-testid="holiday-reason-input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Christmas Day" />
        </div>
        <div className="sm:col-span-2">
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Customer message</Label>
          <Input data-testid="holiday-message-input" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="We'll be closed for Christmas. Back Dec 26 at 10 AM." />
        </div>
        <div className="sm:col-span-4">
          <button data-testid="holiday-add-btn" type="submit" className="inline-flex items-center gap-1 px-4 py-2 bg-brand-primary text-white rounded-full text-sm font-body font-semibold hover:bg-brand-primary-hover">
            <Plus size={13} /> Add holiday
          </button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-brand-primary" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-6 text-sm text-brand-text-secondary" data-testid="holidays-empty">No holidays scheduled.</div>
      ) : (
        <ul className="divide-y divide-brand-border border border-brand-border rounded-lg overflow-hidden" data-testid="holidays-list">
          {items.map((h) => (
            <li key={h.id} data-testid={`holiday-row-${h.id}`} className="flex items-center gap-3 px-3 py-2.5 bg-brand-bg/30">
              <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0"><CalendarOff size={14} /></div>
              <div className="flex-1 min-w-0">
                <div className="font-heading text-sm font-bold text-brand-text">{h.date} · {h.reason || "(no reason)"}</div>
                {h.message && <div className="text-xs text-brand-text-secondary mt-0.5 truncate">"{h.message}"</div>}
              </div>
              <button data-testid={`holiday-delete-${h.id}`} onClick={() => remove(h)} className="p-1.5 rounded-md text-brand-text-secondary hover:text-red-600 hover:bg-red-50" aria-label="Delete">
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


/* ──── Special Hours ─────────────────────────────── */
function SpecialHoursSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    date: "", label: "",
    delivery: { open_time: "10:00", close_time: "02:00", closed: false },
    pickup: { open_time: "10:00", close_time: "02:00", closed: false },
    dine_in: { open_time: "10:00", close_time: "02:00", closed: false },
  });

  const load = () => axios.get(`${API}/admin/store/special-hours`, { withCredentials: true })
    .then(({ data }) => setItems(data.special_hours || []))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!form.date) return;
    try {
      await axios.post(`${API}/admin/store/special-hours`, {
        date: form.date, label: form.label,
        hours: { delivery: form.delivery, pickup: form.pickup, dine_in: form.dine_in },
      }, { withCredentials: true });
      toast.success("Special hours added");
      setForm((f) => ({ ...f, date: "", label: "" }));
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Add failed"); }
  };
  const remove = async (sp) => {
    if (!window.confirm(`Remove special hours for ${sp.date}?`)) return;
    await axios.delete(`${API}/admin/store/special-hours/${sp.id}`, { withCredentials: true });
    toast.success("Removed"); load();
  };

  return (
    <section data-testid="special-hours-section" className="bg-brand-surface border border-brand-border rounded-2xl p-5">
      <h2 className="font-heading text-base font-bold text-brand-text mb-1 inline-flex items-center gap-2">
        <Info size={16} className="text-brand-primary" /> Extended / special hours
      </h2>
      <p className="font-body text-xs text-brand-text-secondary mb-4">Override the weekly schedule for a specific date (e.g. New Year's Eve open until 2 AM).</p>

      <form onSubmit={add} data-testid="special-form" className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Date</Label>
          <Input data-testid="special-date-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        </div>
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Label</Label>
          <Input data-testid="special-label-input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="New Year's Eve" />
        </div>
        {SERVICES.map((s) => (
          <div key={s.key} className="sm:col-span-2 flex items-center gap-2 flex-wrap bg-brand-bg rounded-lg p-2.5">
            <span className="w-16 text-xs font-body font-semibold text-brand-text">{s.label}</span>
            <Input data-testid={`special-${s.key}-open`} type="time" value={form[s.key].open_time} onChange={(e) => setForm({ ...form, [s.key]: { ...form[s.key], open_time: e.target.value } })} className="h-9 w-[112px] px-2 tabular-nums" disabled={form[s.key].closed} />
            <span className="text-xs text-brand-text-secondary">–</span>
            <Input data-testid={`special-${s.key}-close`} type="time" value={form[s.key].close_time} onChange={(e) => setForm({ ...form, [s.key]: { ...form[s.key], close_time: e.target.value } })} className="h-9 w-[112px] px-2 tabular-nums" disabled={form[s.key].closed} />
            <label className="inline-flex items-center gap-1.5 text-xs text-brand-text-secondary">
              <Switch data-testid={`special-${s.key}-toggle`} checked={!form[s.key].closed} onCheckedChange={(v) => setForm({ ...form, [s.key]: { ...form[s.key], closed: !v } })} />
              {form[s.key].closed ? "Closed" : "Open"}
            </label>
          </div>
        ))}
        <div className="sm:col-span-2">
          <button data-testid="special-add-btn" type="submit" className="inline-flex items-center gap-1 px-4 py-2 bg-brand-primary text-white rounded-full text-sm font-body font-semibold hover:bg-brand-primary-hover">
            <Plus size={13} /> Add special hours
          </button>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-brand-primary" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-6 text-sm text-brand-text-secondary" data-testid="special-empty">No extended hours scheduled.</div>
      ) : (
        <ul className="divide-y divide-brand-border border border-brand-border rounded-lg overflow-hidden" data-testid="special-list">
          {items.map((sp) => (
            <li key={sp.id} data-testid={`special-row-${sp.id}`} className="flex items-center gap-3 px-3 py-2.5 bg-amber-50/50">
              <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0"><Calendar size={14} /></div>
              <div className="flex-1 min-w-0">
                <div className="font-heading text-sm font-bold text-brand-text">{sp.date}{sp.label ? ` · ${sp.label}` : ""}</div>
                <div className="text-[11px] text-brand-text-secondary mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {SERVICES.map((s) => {
                    const v = sp.hours?.[s.key];
                    return <span key={s.key}><strong className="text-brand-text">{s.label}:</strong> {v?.closed ? "Closed" : `${v?.open_time || "--:--"}–${v?.close_time || "--:--"}`}</span>;
                  })}
                </div>
              </div>
              <button data-testid={`special-delete-${sp.id}`} onClick={() => remove(sp)} className="p-1.5 rounded-md text-brand-text-secondary hover:text-red-600 hover:bg-red-50" aria-label="Delete">
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


/* ──── Advance-order config ──────────────────────── */
function AdvanceOrdersCard({ advance, onSave }) {
  const [local, setLocal] = useState(advance);
  useEffect(() => setLocal(advance), [advance]);
  const dirty = local.accept_advance_orders !== advance.accept_advance_orders || Number(local.max_days_ahead) !== Number(advance.max_days_ahead);

  return (
    <section data-testid="advance-orders-card" className="bg-brand-surface border border-brand-border rounded-2xl p-5">
      <h2 className="font-heading text-base font-bold text-brand-text mb-1 inline-flex items-center gap-2">
        <Clock size={16} className="text-brand-primary" /> Advance ordering
      </h2>
      <p className="font-body text-xs text-brand-text-secondary mb-4">Allow guests to schedule orders for later. When enabled, an "Order for Later" CTA shows on the closed-store overlay.</p>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <label className="inline-flex items-center gap-3">
          <Switch data-testid="accept-advance-switch" checked={!!local.accept_advance_orders} onCheckedChange={(v) => setLocal({ ...local, accept_advance_orders: v })} />
          <span className="font-body text-sm text-brand-text font-medium">{local.accept_advance_orders ? "Accepting advance orders" : "Advance orders disabled"}</span>
        </label>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-brand-text-secondary">Up to</Label>
          <Input
            data-testid="advance-days-input"
            type="number"
            min="1" max="30"
            value={local.max_days_ahead}
            onChange={(e) => setLocal({ ...local, max_days_ahead: Number(e.target.value) })}
            className="h-9 w-20"
            disabled={!local.accept_advance_orders}
          />
          <span className="text-xs text-brand-text-secondary">days ahead</span>
        </div>
        <button
          data-testid="advance-save-btn"
          disabled={!dirty}
          onClick={() => onSave({ accept_advance_orders: local.accept_advance_orders, max_days_ahead: Number(local.max_days_ahead) })}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-brand-primary text-white rounded-full text-sm font-body font-semibold hover:bg-brand-primary-hover disabled:opacity-50"
        >
          <Save size={12} /> Save
        </button>
      </div>
    </section>
  );
}
