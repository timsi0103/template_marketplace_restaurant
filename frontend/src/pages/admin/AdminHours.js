import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import axios from "axios";

const API_BASE = "/api";
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };
const SERVICES = [
  { key: "delivery", label: "Delivery" },
  { key: "pickup", label: "Pickup" },
  { key: "dine_in", label: "Dine-In" },
];

const DEFAULT_SVC = { open_time: "10:00", close_time: "22:00", closed: false };

export default function AdminHours() {
  const [hours, setHours] = useState({});
  const [pauseOrdering, setPauseOrdering] = useState(false);
  const [activeService, setActiveService] = useState("delivery");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE}/admin/store/hours`, { withCredentials: true })
      .then(({ data }) => { setHours(data.hours || {}); setPauseOrdering(data.pause_ordering || false); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getDayService = (day, svc) => {
    return hours[day]?.[svc] || { ...DEFAULT_SVC };
  };

  const updateDayService = (day, svc, field, value) => {
    setHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [svc]: { ...getDayService(day, svc), [field]: value } }
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_BASE}/admin/store/hours`, { hours }, { withCredentials: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error("Save failed", e); }
    finally { setSaving(false); }
  };

  const handlePauseToggle = async () => {
    try {
      const { data } = await axios.post(`${API_BASE}/admin/store/pause`, {}, { withCredentials: true });
      setPauseOrdering(data.pause_ordering);
    } catch (e) { console.error("Pause toggle failed", e); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 data-testid="hours-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text tracking-tight">Operating Hours</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">Configure opening hours for each service type.</p>
        </div>
        <button data-testid="save-hours-btn" onClick={handleSave} disabled={saving}
          className={`px-6 py-2.5 font-body text-sm font-semibold rounded-lg transition-colors ${saved ? "bg-green-600 text-white" : "bg-brand-primary text-white hover:bg-brand-primary-hover"} disabled:opacity-50`}>
          {saving ? "Saving..." : saved ? "Saved!" : "Save Hours"}
        </button>
      </div>

      {/* Pause Ordering */}
      <div data-testid="pause-ordering-card" className={`mb-8 p-5 rounded-xl border ${pauseOrdering ? "bg-red-50 border-red-200" : "bg-brand-surface border-brand-border"}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`font-heading text-base font-bold ${pauseOrdering ? "text-red-700" : "text-brand-text"}`}>
              {pauseOrdering ? "Ordering is PAUSED" : "Ordering is Active"}
            </h3>
            <p className="font-body text-xs text-brand-text-secondary mt-0.5">Emergency toggle to immediately stop all orders.</p>
          </div>
          <button data-testid="pause-ordering-btn" onClick={handlePauseToggle}
            className={`px-4 py-2 rounded-lg font-body text-sm font-semibold transition-colors ${pauseOrdering ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`}>
            {pauseOrdering ? "Resume Ordering" : "Pause Ordering"}
          </button>
        </div>
      </div>

      {/* Service Type Tabs */}
      <div data-testid="service-tabs" className="flex gap-2 mb-6">
        {SERVICES.map((svc) => (
          <button key={svc.key} data-testid={`tab-${svc.key}`} onClick={() => setActiveService(svc.key)}
            className={`px-4 py-2 rounded-lg font-body text-sm font-medium border transition-all ${activeService === svc.key ? "bg-brand-primary text-white border-brand-primary" : "bg-brand-surface text-brand-text-secondary border-brand-border hover:border-brand-text"}`}>
            {svc.label}
          </button>
        ))}
      </div>

      {/* Day-by-Day Table */}
      <div data-testid="hours-table" className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[80px_1fr_1fr_60px] sm:grid-cols-[100px_1fr_1fr_80px] border-b border-brand-border bg-brand-bg/50 px-4 py-3">
          <span className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Day</span>
          <span className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Opens</span>
          <span className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Closes</span>
          <span className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary text-center">Open</span>
        </div>
        {DAYS.map((day) => {
          const svc = getDayService(day, activeService);
          const isClosed = svc.closed;
          return (
            <div key={day} data-testid={`hours-row-${day}`}
              className={`grid grid-cols-[80px_1fr_1fr_60px] sm:grid-cols-[100px_1fr_1fr_80px] items-center border-b border-brand-border last:border-0 px-4 py-3 ${isClosed ? "bg-brand-bg/30" : ""}`}>
              <span className={`font-heading text-sm font-bold capitalize ${isClosed ? "text-brand-text-secondary" : "text-brand-text"}`}>
                <span className="hidden sm:inline">{day.charAt(0).toUpperCase() + day.slice(1)}</span>
                <span className="sm:hidden">{DAY_LABELS[day]}</span>
              </span>
              <Input type="time" value={svc.open_time} onChange={(e) => updateDayService(day, activeService, "open_time", e.target.value)}
                disabled={isClosed} data-testid={`open-${day}`}
                className={`bg-brand-bg border-brand-border font-body text-sm h-9 w-28 sm:w-32 ${isClosed ? "opacity-40" : ""}`} />
              <Input type="time" value={svc.close_time} onChange={(e) => updateDayService(day, activeService, "close_time", e.target.value)}
                disabled={isClosed} data-testid={`close-${day}`}
                className={`bg-brand-bg border-brand-border font-body text-sm h-9 w-28 sm:w-32 ${isClosed ? "opacity-40" : ""}`} />
              <div className="flex justify-center">
                <Switch data-testid={`toggle-${day}`} checked={!isClosed} onCheckedChange={(v) => updateDayService(day, activeService, "closed", !v)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
