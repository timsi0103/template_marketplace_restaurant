import { useState, useEffect } from "react";
import { Plus, Trash2, Calendar, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import axios from "axios";

const API_BASE = "/api";

export default function AdminHolidays() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: "", reason: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE}/admin/store/holidays`, { withCredentials: true })
      .then(({ data }) => setHolidays(data.holidays || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!form.date) return;
    setSaving(true);
    try {
      const { data } = await axios.post(`${API_BASE}/admin/store/holidays`, { date: form.date, reason: form.reason, all_day: true }, { withCredentials: true });
      setHolidays(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)));
      setForm({ date: "", reason: "" });
    } catch (e) { console.error("Add holiday failed", e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (holId) => {
    try {
      await axios.delete(`${API_BASE}/admin/store/holidays/${holId}`, { withCredentials: true });
      setHolidays(prev => prev.filter(h => h.id !== holId));
    } catch (e) { console.error("Delete failed", e); }
  };

  const today = new Date().toISOString().split("T")[0];
  const upcoming = holidays.filter(h => h.date >= today);
  const past = holidays.filter(h => h.date < today);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <h1 data-testid="holidays-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text tracking-tight mb-2">Holiday & Closures</h1>
      <p className="font-body text-sm text-brand-text-secondary mb-8">Schedule closures for holidays, events, or maintenance.</p>

      {/* Add Holiday Form */}
      <div data-testid="add-holiday-form" className="bg-brand-surface border border-brand-border rounded-xl p-5 mb-8">
        <h2 className="font-heading text-lg font-bold text-brand-text mb-4">Add Closure Date</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Date</Label>
            <Input type="date" value={form.date} min={today} onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))} data-testid="holiday-date-input" className="bg-brand-bg border-brand-border font-body text-sm h-10" />
          </div>
          <div className="flex-[2]">
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Reason</Label>
            <Input value={form.reason} onChange={(e) => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="e.g. Christmas Day, Staff Training" data-testid="holiday-reason-input" className="bg-brand-bg border-brand-border font-body text-sm h-10" />
          </div>
          <div className="flex items-end">
            <button data-testid="add-holiday-btn" onClick={handleAdd} disabled={saving || !form.date}
              className="px-5 py-2.5 bg-brand-primary text-white font-body text-sm font-medium rounded-lg hover:bg-brand-primary-hover disabled:opacity-50 transition-colors flex items-center gap-1.5">
              <Plus size={14} /> Add
            </button>
          </div>
        </div>
      </div>

      {/* Upcoming Closures */}
      <div data-testid="upcoming-closures">
        <h2 className="font-heading text-lg font-bold text-brand-text mb-3 flex items-center gap-2">
          <Calendar size={18} className="text-brand-primary" /> Upcoming Closures
        </h2>
        {upcoming.length === 0 ? (
          <div className="bg-brand-surface border border-brand-border rounded-xl p-6 text-center mb-8">
            <p className="font-body text-sm text-brand-text-secondary">No upcoming closures scheduled.</p>
          </div>
        ) : (
          <div className="space-y-2 mb-8">
            {upcoming.map((h) => {
              const isToday = h.date === today;
              return (
                <div key={h.id} data-testid={`holiday-${h.id}`}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border ${isToday ? "bg-red-50 border-red-200" : "bg-brand-surface border-brand-border"}`}>
                  <div className="flex items-center gap-3">
                    {isToday && <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />}
                    <div>
                      <p className={`font-body text-sm font-medium ${isToday ? "text-red-700" : "text-brand-text"}`}>
                        {h.date} {isToday && <span className="text-red-500 text-xs">(Today)</span>}
                      </p>
                      {h.reason && <p className="font-body text-xs text-brand-text-secondary">{h.reason}</p>}
                    </div>
                  </div>
                  <button data-testid={`delete-holiday-${h.id}`} onClick={() => handleDelete(h.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-text-secondary hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Closures */}
      {past.length > 0 && (
        <div data-testid="past-closures">
          <h2 className="font-heading text-lg font-bold text-brand-text-secondary mb-3">Past Closures</h2>
          <div className="space-y-2 opacity-60">
            {past.slice(-5).reverse().map((h) => (
              <div key={h.id} className="flex items-center justify-between px-4 py-2 bg-brand-bg rounded-lg">
                <div>
                  <p className="font-body text-sm text-brand-text-secondary">{h.date}</p>
                  {h.reason && <p className="font-body text-xs text-brand-text-secondary">{h.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
