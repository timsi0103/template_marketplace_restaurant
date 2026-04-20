import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Save, Plus, X, Loader2, Volume2, VolumeX, ArrowUpRight, Columns2, Columns3, Columns4 } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const API = "/api";

export default function AdminKDSSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/admin/kds/settings`, { withCredentials: true })
      .then(({ data }) => setSettings(data))
      .catch(() => toast.error("Could not load settings"))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !settings) {
    return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-brand-primary" /></div>;
  }

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await axios.put(`${API}/admin/kds/settings`, {
        audio_enabled: settings.audio_enabled,
        default_columns: settings.default_columns,
        target_prep_minutes_by_category: settings.target_prep_minutes_by_category,
        station_routing: settings.station_routing,
      }, { withCredentials: true });
      setSettings(data);
      toast.success("KDS settings saved");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const prepMap = settings.target_prep_minutes_by_category || {};
  const routing = settings.station_routing || {};

  const setPrep = (cat, mins) => setSettings((s) => ({
    ...s, target_prep_minutes_by_category: { ...s.target_prep_minutes_by_category, [cat]: Math.max(1, Number(mins) || 1) },
  }));
  const renamePrep = (oldCat, newCat) => {
    if (!newCat.trim() || newCat === oldCat) return;
    setSettings((s) => {
      const { [oldCat]: val, ...rest } = s.target_prep_minutes_by_category || {};
      return { ...s, target_prep_minutes_by_category: { ...rest, [newCat.toLowerCase()]: val } };
    });
  };
  const removePrep = (cat) => setSettings((s) => {
    const clone = { ...s.target_prep_minutes_by_category };
    delete clone[cat];
    return { ...s, target_prep_minutes_by_category: clone };
  });
  const addPrep = () => {
    const name = window.prompt("New category name (e.g. pasta):");
    if (!name) return;
    const key = name.trim().toLowerCase();
    if (prepMap[key]) { toast.error("Category already exists"); return; }
    setSettings((s) => ({ ...s, target_prep_minutes_by_category: { ...s.target_prep_minutes_by_category, [key]: 10 } }));
  };

  const toggleStationCategory = (station, cat) => {
    setSettings((s) => {
      const cats = new Set(s.station_routing?.[station] || []);
      if (cats.has(cat)) cats.delete(cat); else cats.add(cat);
      return { ...s, station_routing: { ...s.station_routing, [station]: Array.from(cats) } };
    });
  };
  const addStation = () => {
    const name = window.prompt("Station name (e.g. sushi):");
    if (!name) return;
    const key = name.trim().toLowerCase();
    if (routing[key]) { toast.error("Station already exists"); return; }
    setSettings((s) => ({ ...s, station_routing: { ...s.station_routing, [key]: [] } }));
  };
  const removeStation = (station) => {
    if (!window.confirm(`Remove "${station}" station?`)) return;
    setSettings((s) => {
      const clone = { ...s.station_routing };
      delete clone[station];
      return { ...s, station_routing: clone };
    });
  };

  const allCategories = Object.keys(prepMap);

  return (
    <div data-testid="kds-settings-page" className="p-6 lg:p-10 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 data-testid="kds-settings-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">KDS settings</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">Configure kitchen display targets, station routing, and alerts.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/kds" data-testid="open-kds-btn" target="_blank" className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text font-body text-sm font-medium rounded-full hover:bg-brand-surface">
            <ArrowUpRight size={14} /> Open KDS
          </Link>
          <button
            data-testid="kds-settings-save"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
          </button>
        </div>
      </div>

      {/* Global section */}
      <Section title="Display & alerts">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-brand-border bg-brand-bg">
            <div className="flex items-start gap-3">
              {settings.audio_enabled ? <Volume2 size={16} className="text-brand-primary mt-1" /> : <VolumeX size={16} className="text-brand-text-secondary mt-1" />}
              <div className="flex-1">
                <div className="font-heading text-sm font-bold text-brand-text">Audio chime on new orders</div>
                <div className="font-body text-xs text-brand-text-secondary">Plays a short tone when a new paid order arrives on the KDS.</div>
              </div>
              <Switch
                data-testid="kds-audio-switch"
                checked={!!settings.audio_enabled}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, audio_enabled: v }))}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-brand-border bg-brand-bg">
            <div className="font-heading text-sm font-bold text-brand-text mb-2">Default layout</div>
            <div className="flex items-center gap-2">
              {[2, 3, 4].map((n) => {
                const Icon = n === 2 ? Columns2 : n === 3 ? Columns3 : Columns4;
                const active = settings.default_columns === n;
                return (
                  <button
                    key={n}
                    data-testid={`kds-default-cols-${n}`}
                    onClick={() => setSettings((s) => ({ ...s, default_columns: n }))}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition ${active ? "border-brand-primary bg-brand-primary/5 text-brand-primary" : "border-brand-border text-brand-text-secondary hover:border-brand-primary/40"}`}
                  >
                    <Icon size={14} /> <span className="font-body text-sm font-medium">{n} col</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      {/* Target prep time */}
      <Section title="Target prep time by category" actions={
        <button data-testid="add-category-btn" onClick={addPrep} className="inline-flex items-center gap-1 px-3 py-1.5 border border-brand-border rounded-full font-body text-xs font-semibold hover:bg-brand-surface">
          <Plus size={12} /> Add category
        </button>
      }>
        <div className="space-y-2">
          {Object.keys(prepMap).length === 0 && <p className="font-body text-sm text-brand-text-secondary">No categories yet. Add one to set its target prep time.</p>}
          {Object.entries(prepMap).map(([cat, mins]) => (
            <div key={cat} data-testid={`prep-row-${cat}`} className="flex items-center gap-3 p-3 rounded-lg border border-brand-border bg-brand-bg">
              <Input
                data-testid={`prep-cat-${cat}`}
                defaultValue={cat}
                onBlur={(e) => renamePrep(cat, e.target.value.trim())}
                className="flex-1 h-10 bg-brand-surface border-brand-border font-mono uppercase tracking-wider"
              />
              <div className="flex items-center gap-1">
                <Input
                  data-testid={`prep-mins-${cat}`}
                  type="number"
                  min={1}
                  value={mins}
                  onChange={(e) => setPrep(cat, e.target.value)}
                  className="w-20 h-10 bg-brand-surface border-brand-border text-center"
                />
                <span className="font-body text-xs text-brand-text-secondary">min</span>
              </div>
              <button
                data-testid={`prep-remove-${cat}`}
                onClick={() => removePrep(cat)}
                className="p-2 rounded-full text-brand-text-secondary hover:text-red-500 hover:bg-red-50"
                aria-label="Remove"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* Station routing */}
      <Section title="Station routing" actions={
        <button data-testid="add-station-btn" onClick={addStation} className="inline-flex items-center gap-1 px-3 py-1.5 border border-brand-border rounded-full font-body text-xs font-semibold hover:bg-brand-surface">
          <Plus size={12} /> Add station
        </button>
      }>
        <p className="font-body text-xs text-brand-text-secondary mb-3">Assign each category to one or more stations. The KDS station view (`/kds/:station`) will show only orders with items matching that station.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(routing).map(([station, cats]) => (
            <div key={station} data-testid={`station-card-${station}`} className="p-4 rounded-xl border border-brand-border bg-brand-bg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-heading text-base font-bold text-brand-text capitalize">{station}</h3>
                  <Link to={`/kds/${station}`} target="_blank" className="font-body text-[10px] uppercase tracking-widest text-brand-primary hover:underline">Open →</Link>
                </div>
                <button
                  data-testid={`station-remove-${station}`}
                  onClick={() => removeStation(station)}
                  className="p-1.5 rounded-full text-brand-text-secondary hover:text-red-500 hover:bg-red-50"
                  aria-label="Remove station"
                >
                  <X size={14} />
                </button>
              </div>
              <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-2 block">Categories routed here</Label>
              <div className="flex flex-wrap gap-1.5">
                {allCategories.length === 0 && <span className="text-xs text-brand-text-secondary italic">Add categories above first.</span>}
                {allCategories.map((cat) => {
                  const active = cats.includes(cat);
                  return (
                    <button
                      key={cat}
                      data-testid={`station-cat-${station}-${cat}`}
                      onClick={() => toggleStationCategory(station, cat)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-body font-medium border transition ${active ? "bg-brand-primary text-white border-brand-primary" : "border-brand-border text-brand-text-secondary hover:border-brand-primary/40"}`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, actions, children }) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-base font-bold text-brand-text">{title}</h2>
        {actions}
      </div>
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">{children}</div>
    </section>
  );
}
