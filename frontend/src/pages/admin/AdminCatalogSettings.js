import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Save, Loader2, RotateCcw, ExternalLink, Filter, Eye, ArrowUpDown, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const API = "/api";

const DIETARY_LABELS = {
  vegan: "Vegan", vegetarian: "Vegetarian", gluten_free: "Gluten-Free",
  dairy_free: "Dairy-Free", halal: "Halal", kosher: "Kosher",
  nut_free: "Nut-Free", spicy: "Spicy", low_carb: "Low-Carb",
};

const SORT_OPTIONS = [
  { value: "popularity", label: "Popularity" },
  { value: "price_asc", label: "Price: low → high" },
  { value: "price_desc", label: "Price: high → low" },
  { value: "newest", label: "Newest" },
  { value: "name_asc", label: "Name (A → Z)" },
];

export default function AdminCatalogSettings() {
  const [s, setS] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/admin/catalog/settings`, { withCredentials: true })
      .then(({ data }) => { setS(data); setOriginal(JSON.parse(JSON.stringify(data))); })
      .catch(() => toast.error("Could not load catalog settings"))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !s) {
    return <div data-testid="catalog-settings-loading" className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-brand-primary" /></div>;
  }

  const dirty = JSON.stringify(s) !== JSON.stringify(original);
  const setField = (k, v) => setS((p) => ({ ...p, [k]: v }));
  const toggleTag = (tag) => setS((p) => {
    const current = new Set(p.visible_dietary_tags || []);
    current.has(tag) ? current.delete(tag) : current.add(tag);
    return { ...p, visible_dietary_tags: [...current] };
  });

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        visible_dietary_tags: s.visible_dietary_tags,
        default_sort: s.default_sort,
        quick_view_enabled: s.quick_view_enabled,
        price_min: Number(s.price_min),
        price_max: Number(s.price_max),
        sticky_category_bar: s.sticky_category_bar,
        show_in_stock_toggle: s.show_in_stock_toggle,
      };
      const { data } = await axios.patch(`${API}/admin/catalog/settings`, payload, { withCredentials: true });
      setS(data); setOriginal(JSON.parse(JSON.stringify(data)));
      toast.success("Catalog settings saved — live on menu.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  };

  const reset = () => { if (dirty && window.confirm("Discard unsaved changes?")) setS(JSON.parse(JSON.stringify(original))); };

  const allTags = s.all_dietary_tags || Object.keys(DIETARY_LABELS);
  const visibleSet = new Set(s.visible_dietary_tags || []);

  return (
    <div data-testid="admin-catalog-settings-page" className="p-6 lg:p-10 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 data-testid="catalog-settings-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">Menu & search configuration</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">Control how guests browse, search, and filter your menu.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/menu" target="_blank" data-testid="catalog-preview-link" className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text font-body text-sm font-medium rounded-full hover:bg-brand-surface">
            <ExternalLink size={14} /> Preview menu
          </Link>
          {dirty && (
            <button data-testid="catalog-reset-btn" onClick={reset} className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text-secondary font-body text-sm font-medium rounded-full hover:bg-brand-surface">
              <RotateCcw size={14} /> Discard
            </button>
          )}
          <button
            data-testid="catalog-save-btn"
            onClick={save}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {dirty ? "Save & publish" : "Saved"}
          </button>
        </div>
      </div>

      <Section title="Dietary filters" subtitle="Pick which dietary chips show in the menu filter drawer." icon={Filter}>
        <div className="flex flex-wrap gap-2" data-testid="dietary-toggle-grid">
          {allTags.map((tag) => {
            const active = visibleSet.has(tag);
            return (
              <button
                key={tag}
                data-testid={`dietary-toggle-${tag}`}
                onClick={() => toggleTag(tag)}
                className={`px-3.5 py-1.5 rounded-full border text-xs font-body font-medium transition ${active ? "bg-brand-primary text-white border-brand-primary" : "border-brand-border text-brand-text hover:border-brand-primary/50"}`}
              >
                {DIETARY_LABELS[tag] || tag}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Default sort" subtitle="The initial sort order applied when guests open the menu." icon={ArrowUpDown}>
        <select
          data-testid="default-sort-select"
          value={s.default_sort}
          onChange={(e) => setField("default_sort", e.target.value)}
          className="h-10 px-3 min-w-56 rounded-lg border border-brand-border bg-brand-surface text-sm font-body text-brand-text"
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Section>

      <Section title="Price range bounds" subtitle="Defines the slider min/max on the filter drawer." icon={DollarSign}>
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <div>
            <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Min ($)</Label>
            <Input data-testid="price-min-input" type="number" min={0} value={s.price_min} onChange={(e) => setField("price_min", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Max ($)</Label>
            <Input data-testid="price-max-input" type="number" min={1} value={s.price_max} onChange={(e) => setField("price_max", e.target.value)} className="mt-1.5" />
          </div>
        </div>
      </Section>

      <Section title="Browsing experience" subtitle="Small interaction tweaks on the storefront menu page." icon={Eye}>
        <div className="space-y-3">
          <ToggleRow
            title="Quick-view modal"
            subtitle="Guests click an item to open details + add-to-cart without leaving the menu."
            checked={s.quick_view_enabled}
            onCheckedChange={(v) => setField("quick_view_enabled", v)}
            testId="quick-view-switch"
          />
          <ToggleRow
            title="Sticky category bar"
            subtitle="Category pills pin to the top as the guest scrolls."
            checked={s.sticky_category_bar}
            onCheckedChange={(v) => setField("sticky_category_bar", v)}
            testId="sticky-bar-switch"
          />
          <ToggleRow
            title="In-stock only toggle"
            subtitle="Shows a switch in the filter drawer to hide sold-out items."
            checked={s.show_in_stock_toggle}
            onCheckedChange={(v) => setField("show_in_stock_toggle", v)}
            testId="in-stock-toggle-switch"
          />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, subtitle, icon: Icon, children }) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2">
          {Icon && <Icon size={16} className="text-brand-primary" />} {title}
        </h2>
        {subtitle && <p className="font-body text-xs text-brand-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">{children}</div>
    </section>
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
