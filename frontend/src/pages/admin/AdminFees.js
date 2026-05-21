import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Loader2, Save, Plus, Trash2, Download, Calculator, Receipt, Truck, Package, Leaf,
  MapPin, RefreshCcw, Info, Star,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const API = "/api";

const SAMPLE_ITEMS = [
  { item_id: "item-001", category: "mains", name: "Heritage Duck Breast", price: 42, qty: 1 },
  { item_id: "item-006", category: "desserts", name: "Hazelnut Ganache Tart", price: 14, qty: 2 },
];

export default function AdminFees() {
  const [regions, setRegions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [local, setLocal] = useState(null);
  const [original, setOriginal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/fees/regions`, { withCredentials: true });
      setRegions(data.regions || []);
      const keep = data.regions.find((r) => r.id === activeId) || data.regions.find((r) => r.is_default) || data.regions[0];
      if (keep) pickRegion(keep);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const pickRegion = (r) => {
    setActiveId(r.id);
    setLocal(JSON.parse(JSON.stringify(r)));
    setOriginal(JSON.parse(JSON.stringify(r)));
  };
  const dirty = useMemo(() => JSON.stringify(local) !== JSON.stringify(original), [local, original]);

  const save = async () => {
    if (!local) return;
    setSaving(true);
    try {
      const { data } = await axios.patch(`${API}/admin/fees/regions/${local.id}`, {
        name: local.name, region_code: local.region_code, is_default: local.is_default,
        tax: local.tax, service_charge: local.service_charge,
        packaging_fee: local.packaging_fee, eco_fee: local.eco_fee,
        delivery_rules: local.delivery_rules,
      }, { withCredentials: true });
      setOriginal(JSON.parse(JSON.stringify(data)));
      setLocal(JSON.parse(JSON.stringify(data)));
      toast.success("Configuration saved — now live at checkout");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  const createRegion = async () => {
    const name = window.prompt("New region name (e.g. California, UK, Dubai):");
    if (!name) return;
    const code = window.prompt("Short region code (e.g. ca, uk, ae):") || name.toLowerCase().slice(0, 4);
    try {
      const { data } = await axios.post(`${API}/admin/fees/regions`, { name, region_code: code, is_default: false }, { withCredentials: true });
      toast.success("Region created");
      await load();
      pickRegion(data);
    } catch (e) { toast.error(e?.response?.data?.detail || "Create failed"); }
  };

  const deleteRegion = async (r) => {
    if (!window.confirm(`Delete "${r.name}"?`)) return;
    try {
      await axios.delete(`${API}/admin/fees/regions/${r.id}`, { withCredentials: true });
      toast.success("Region removed");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Delete failed"); }
  };

  if (loading || !local) return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-brand-primary" /></div>;

  const setField = (path, value) => {
    setLocal((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split(".");
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!(parts[i] in cur)) cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  };

  return (
    <div data-testid="admin-fees-page" className="p-6 lg:p-10 max-w-6xl space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 data-testid="fees-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">Tax & charges</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">Tax rates, service charge, delivery rules, and additional fees — configurable per region.</p>
        </div>
        <button
          data-testid="fees-save-btn"
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-primary text-white text-sm font-body font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {dirty ? "Save & apply" : "Saved"}
        </button>
      </div>

      {/* Region switcher */}
      <section data-testid="region-switcher" className="bg-brand-surface border border-brand-border rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2">
              <MapPin size={16} className="text-brand-primary" /> Region
            </h2>
            <p className="text-xs text-brand-text-secondary mt-0.5">Configure different tax/fee rules for each jurisdiction.</p>
          </div>
          <button data-testid="create-region-btn" onClick={createRegion} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-brand-primary text-white text-xs font-body font-semibold hover:bg-brand-primary-hover">
            <Plus size={12} /> New region
          </button>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="region-chips">
          {regions.map((r) => (
            <div key={r.id} className="inline-flex items-center">
              <button
                data-testid={`region-chip-${r.id}`}
                onClick={() => pickRegion(r)}
                className={`pl-3 pr-2 py-1.5 rounded-l-full border text-xs font-body font-semibold inline-flex items-center gap-1.5 ${r.id === activeId ? "bg-brand-primary text-white border-brand-primary" : "border-brand-border text-brand-text hover:border-brand-primary/50"}`}
              >
                {r.is_default && <Star size={10} className={r.id === activeId ? "fill-white" : "fill-amber-400 stroke-amber-500"} />}
                {r.name} <span className={`text-[9px] opacity-70 uppercase tracking-wider ${r.id === activeId ? "" : "text-brand-text-secondary"}`}>{r.region_code}</span>
              </button>
              {!r.is_default && (
                <button
                  data-testid={`region-delete-${r.id}`}
                  onClick={() => deleteRegion(r)}
                  className="h-[30px] px-2 rounded-r-full border border-l-0 border-brand-border text-brand-text-secondary hover:text-red-600 hover:bg-red-50 text-xs"
                  aria-label={`Delete ${r.name}`}
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Configuration + live preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          <Card title="Region identity" icon={MapPin}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Name"><Input data-testid="region-name-input" value={local.name || ""} onChange={(e) => setField("name", e.target.value)} /></Field>
              <Field label="Region code"><Input data-testid="region-code-input" value={local.region_code || ""} onChange={(e) => setField("region_code", e.target.value)} /></Field>
              <label className="flex items-center gap-2 h-full">
                <Switch data-testid="region-default-switch" checked={!!local.is_default} onCheckedChange={(v) => setField("is_default", v)} />
                <span className="text-xs text-brand-text font-medium">Default region</span>
              </label>
            </div>
          </Card>

          <Card title="Tax" icon={Receipt}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Tax name" hint="e.g. Sales Tax, VAT, GST"><Input data-testid="tax-name-input" value={local.tax?.name || ""} onChange={(e) => setField("tax.name", e.target.value)} /></Field>
              <Field label="Rate (%)"><Input data-testid="tax-rate-input" type="number" step="0.01" value={local.tax?.rate_pct ?? 0} onChange={(e) => setField("tax.rate_pct", Number(e.target.value))} /></Field>
              <label className="flex items-center gap-2 h-full">
                <Switch data-testid="tax-inclusive-switch" checked={!!local.tax?.inclusive} onCheckedChange={(v) => setField("tax.inclusive", v)} />
                <span className="text-xs text-brand-text font-medium">Prices include tax</span>
              </label>
            </div>
            <OverrideEditor
              testIdPrefix="tax-cat"
              label="Category overrides"
              hint="e.g. prepared food 8.5%, desserts 5%, packaged goods 0%"
              entries={local.tax?.category_overrides || {}}
              onChange={(obj) => setField("tax.category_overrides", obj)}
            />
            <OverrideEditor
              testIdPrefix="tax-item"
              label="Per-item overrides"
              hint="Key is the menu item id"
              entries={local.tax?.item_overrides || {}}
              onChange={(obj) => setField("tax.item_overrides", obj)}
            />
          </Card>

          <Card title="Service charge" icon={Calculator}>
            <ChargeFields testIdPrefix="service" cfg={local.service_charge} onChange={(k, v) => setField(`service_charge.${k}`, v)} supportsPercent />
          </Card>

          <Card title="Delivery rules" icon={Truck}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <Field label="Rule type">
                <select
                  data-testid="delivery-type-select"
                  value={local.delivery_rules?.type || "flat"}
                  onChange={(e) => setField("delivery_rules.type", e.target.value)}
                  className="h-10 w-full rounded-md border border-brand-border bg-white text-sm px-2"
                >
                  <option value="flat">Flat rate</option>
                  <option value="distance">Distance-based</option>
                  <option value="tiered">Tiered by order value</option>
                </select>
              </Field>
              <Field label="Minimum order for delivery ($)">
                <Input data-testid="delivery-min-order-input" type="number" step="0.01" value={local.delivery_rules?.min_order ?? 0} onChange={(e) => setField("delivery_rules.min_order", Number(e.target.value))} />
              </Field>
              {local.delivery_rules?.type === "flat" && (
                <Field label="Flat fee ($)">
                  <Input data-testid="delivery-flat-input" type="number" step="0.01" value={local.delivery_rules?.flat_amount ?? 0} onChange={(e) => setField("delivery_rules.flat_amount", Number(e.target.value))} />
                </Field>
              )}
              {local.delivery_rules?.type === "distance" && (
                <>
                  <Field label="Base included (km)">
                    <Input data-testid="delivery-base-km-input" type="number" step="0.1" value={local.delivery_rules?.base_distance_km ?? 0} onChange={(e) => setField("delivery_rules.base_distance_km", Number(e.target.value))} />
                  </Field>
                  <Field label="Per additional km ($)">
                    <Input data-testid="delivery-per-km-input" type="number" step="0.01" value={local.delivery_rules?.per_km ?? 0} onChange={(e) => setField("delivery_rules.per_km", Number(e.target.value))} />
                  </Field>
                </>
              )}
            </div>
            {local.delivery_rules?.type === "tiered" && (
              <TieredEditor
                tiers={local.delivery_rules?.tiers || []}
                onChange={(arr) => setField("delivery_rules.tiers", arr)}
              />
            )}
          </Card>

          <Card title="Packaging fee" icon={Package}>
            <ChargeFields testIdPrefix="packaging" cfg={local.packaging_fee} onChange={(k, v) => setField(`packaging_fee.${k}`, v)} supportsTaxable />
          </Card>
          <Card title="Eco / compliance fee" icon={Leaf}>
            <ChargeFields testIdPrefix="eco" cfg={local.eco_fee} onChange={(k, v) => setField(`eco_fee.${k}`, v)} supportsTaxable />
          </Card>
          <TaxReportCard regionId={local.id} />
        </div>

        <div className="lg:sticky lg:top-6 self-start">
          <CheckoutPreview regionId={local.id} snapshot={local} />
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ───────────────────────────────── */

function Card({ title, icon: Icon, children }) {
  return (
    <section className="bg-brand-surface border border-brand-border rounded-2xl p-5">
      <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2 mb-4">
        {Icon && <Icon size={16} className="text-brand-primary" />} {title}
      </h2>
      {children}
    </section>
  );
}
function Field({ label, hint, children }) {
  return (
    <div>
      <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5 block">{label}</Label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-brand-text-secondary/80">{hint}</p>}
    </div>
  );
}

function ChargeFields({ testIdPrefix, cfg, onChange, supportsPercent = true, supportsTaxable = false }) {
  const c = cfg || {};
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
      <label className="flex items-center gap-2">
        <Switch data-testid={`${testIdPrefix}-enabled-switch`} checked={!!c.enabled} onCheckedChange={(v) => onChange("enabled", v)} />
        <span className="text-xs text-brand-text font-medium">{c.enabled ? "Enabled" : "Disabled"}</span>
      </label>
      <Field label="Display name">
        <Input data-testid={`${testIdPrefix}-name-input`} value={c.name || ""} onChange={(e) => onChange("name", e.target.value)} disabled={!c.enabled} />
      </Field>
      <Field label="Type">
        <select
          data-testid={`${testIdPrefix}-type-select`}
          value={c.type || "flat"}
          onChange={(e) => onChange("type", e.target.value)}
          disabled={!c.enabled}
          className="h-10 w-full rounded-md border border-brand-border bg-white text-sm px-2 disabled:opacity-50"
        >
          <option value="flat">Flat ($)</option>
          {supportsPercent && <option value="percent">Percent (%)</option>}
        </select>
      </Field>
      <Field label="Amount">
        <Input data-testid={`${testIdPrefix}-amount-input`} type="number" step="0.01" value={c.amount ?? 0} onChange={(e) => onChange("amount", Number(e.target.value))} disabled={!c.enabled} />
      </Field>
      {supportsTaxable && (
        <label className="sm:col-span-4 inline-flex items-center gap-2">
          <Switch data-testid={`${testIdPrefix}-taxable-switch`} checked={!!c.taxable} onCheckedChange={(v) => onChange("taxable", v)} disabled={!c.enabled} />
          <span className="text-xs text-brand-text-secondary">Fee itself is taxable</span>
        </label>
      )}
    </div>
  );
}

function TieredEditor({ tiers, onChange }) {
  const sorted = [...tiers].sort((a, b) => Number(a.min_subtotal) - Number(b.min_subtotal));
  const add = () => onChange([...tiers, { min_subtotal: 0, fee: 0 }]);
  const update = (i, key, val) => {
    const next = tiers.map((t, j) => j === i ? { ...t, [key]: Number(val) } : t);
    onChange(next);
  };
  const remove = (i) => onChange(tiers.filter((_, j) => j !== i));
  return (
    <div className="mt-4 bg-brand-bg rounded-lg p-3" data-testid="tiered-editor">
      <div className="flex items-center justify-between mb-2">
        <span className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary font-semibold">Tiers (order subtotal → fee)</span>
        <button type="button" data-testid="tier-add-btn" onClick={add} className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline">
          <Plus size={11} /> Add tier
        </button>
      </div>
      {sorted.length === 0 && (
        <p className="text-xs text-brand-text-secondary py-1">No tiers yet. Use the flat_amount above as fallback.</p>
      )}
      {sorted.map((t, i) => (
        <div key={`tier-${t.min_subtotal ?? "x"}-${t.fee ?? "x"}-${i}`} data-testid={`tier-row-${i}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-brand-text-secondary uppercase tracking-wider">Min $</span>
            <Input data-testid={`tier-min-${i}`} type="number" step="0.01" value={t.min_subtotal} onChange={(e) => update(tiers.indexOf(t), "min_subtotal", e.target.value)} className="h-9" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-brand-text-secondary uppercase tracking-wider">Fee $</span>
            <Input data-testid={`tier-fee-${i}`} type="number" step="0.01" value={t.fee} onChange={(e) => update(tiers.indexOf(t), "fee", e.target.value)} className="h-9" />
          </div>
          <button type="button" data-testid={`tier-remove-${i}`} onClick={() => remove(tiers.indexOf(t))} className="text-brand-text-secondary hover:text-red-600 p-1.5" aria-label="Remove tier">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

function OverrideEditor({ testIdPrefix, label, hint, entries, onChange }) {
  const list = Object.entries(entries || {});
  const add = () => {
    const key = window.prompt("Key (category slug or item id):");
    if (!key) return;
    const rate = Number(window.prompt("Rate (%):", "0"));
    if (Number.isNaN(rate)) return;
    onChange({ ...(entries || {}), [key]: rate });
  };
  const updateKey = (oldKey, newKey) => {
    if (!newKey || newKey === oldKey) return;
    const next = { ...entries };
    next[newKey] = next[oldKey];
    delete next[oldKey];
    onChange(next);
  };
  const updateRate = (key, rate) => onChange({ ...entries, [key]: Number(rate) });
  const remove = (key) => { const next = { ...entries }; delete next[key]; onChange(next); };
  return (
    <div className="mt-4" data-testid={`${testIdPrefix}-editor`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary font-semibold">{label}</Label>
          {hint && <p className="text-[10px] text-brand-text-secondary/80">{hint}</p>}
        </div>
        <button type="button" data-testid={`${testIdPrefix}-add-btn`} onClick={add} className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline">
          <Plus size={11} /> Add
        </button>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-brand-text-secondary">No overrides — every item uses the default rate.</p>
      ) : (
        <div className="space-y-2">
          {list.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center" data-testid={`${testIdPrefix}-row-${k}`}>
              <Input data-testid={`${testIdPrefix}-key-${k}`} value={k} onChange={(e) => updateKey(k, e.target.value)} className="h-9" />
              <Input data-testid={`${testIdPrefix}-rate-${k}`} type="number" step="0.01" value={v} onChange={(e) => updateRate(k, e.target.value)} className="h-9" />
              <button type="button" data-testid={`${testIdPrefix}-remove-${k}`} onClick={() => remove(k)} className="text-brand-text-secondary hover:text-red-600 p-1.5" aria-label="Remove override">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Live Checkout Preview ───────────────────────── */
function CheckoutPreview({ regionId, snapshot }) {
  const [mode, setMode] = useState("delivery");
  const [distance, setDistance] = useState(3);
  const [tip, setTip] = useState(0);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);

  // Keep the preview fresh whenever the admin edits the config — send the unsaved snapshot
  // as `region_override` so the preview reflects edits before Save.
  useEffect(() => {
    setLoading(true);
    axios.post(`${API}/fees/quote`, {
      items: SAMPLE_ITEMS,
      fulfillment_type: mode,
      region_id: regionId,
      region_override: snapshot ? {
        tax: snapshot.tax,
        service_charge: snapshot.service_charge,
        packaging_fee: snapshot.packaging_fee,
        eco_fee: snapshot.eco_fee,
        delivery_rules: snapshot.delivery_rules,
      } : undefined,
      distance_km: distance,
      tip,
    }).then(({ data }) => setQuote(data))
      .catch(() => setQuote(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionId, mode, distance, tip, JSON.stringify(snapshot)]);

  return (
    <div data-testid="checkout-preview" className="bg-white border-2 border-dashed border-brand-border rounded-2xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2">
          <Calculator size={15} className="text-brand-primary" /> Checkout preview
        </h3>
        <div className="inline-flex rounded-full border border-brand-border p-0.5">
          {["delivery", "pickup", "dine_in"].map((m) => (
            <button
              key={m}
              data-testid={`preview-mode-${m}`}
              onClick={() => setMode(m)}
              className={`px-2.5 py-0.5 text-[10px] rounded-full font-body font-semibold capitalize ${mode === m ? "bg-brand-primary text-white" : "text-brand-text-secondary"}`}
            >{m.replace("_", "-")}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        {mode === "delivery" && (
          <label className="flex items-center gap-1">
            <span className="text-brand-text-secondary">km</span>
            <Input data-testid="preview-distance-input" type="number" step="0.1" value={distance} onChange={(e) => setDistance(Number(e.target.value))} className="h-8" />
          </label>
        )}
        <label className="flex items-center gap-1">
          <span className="text-brand-text-secondary">tip $</span>
          <Input data-testid="preview-tip-input" type="number" step="0.5" value={tip} onChange={(e) => setTip(Number(e.target.value))} className="h-8" />
        </label>
      </div>

      <p className="text-[10px] text-brand-text-secondary mb-3 inline-flex items-center gap-1">
        <Info size={10} /> Sample cart: duck $42 + 2× tart $14.
      </p>

      {loading || !quote ? (
        <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-brand-primary" /></div>
      ) : (
        <div className="space-y-1 text-sm" data-testid="preview-totals">
          {quote.lines.map((l, i) => (
            <Row key={l.item_id ? `${l.item_id}-${i}` : `line-${i}`} testid={`preview-line-${i}`} label={`${l.qty}× ${l.name || l.item_id}`} value={`$${l.line_total.toFixed(2)}`} sub />
          ))}
          <div className="border-t border-brand-border pt-2 mt-2" />
          <Row testid="preview-subtotal" label="Subtotal" value={`$${quote.subtotal.toFixed(2)}`} />
          {quote.delivery_fee > 0 && <Row testid="preview-delivery" label="Delivery" value={`$${quote.delivery_fee.toFixed(2)}`} />}
          {quote.packaging_fee > 0 && <Row testid="preview-packaging" label={quote.packaging_fee_name} value={`$${quote.packaging_fee.toFixed(2)}`} />}
          {quote.eco_fee > 0 && <Row testid="preview-eco" label={quote.eco_fee_name} value={`$${quote.eco_fee.toFixed(2)}`} />}
          {quote.service_charge > 0 && <Row testid="preview-service" label={quote.service_charge_name} value={`$${quote.service_charge.toFixed(2)}`} />}
          <Row
            testid="preview-tax"
            label={`${quote.region.tax_name}${quote.region.inclusive ? " (incl.)" : ""}`}
            value={`$${quote.tax.toFixed(2)}`}
          />
          {quote.tax_breakdown.length > 1 && (
            <div className="ml-2 pl-2 border-l border-brand-border" data-testid="preview-tax-breakdown">
              {quote.tax_breakdown.map((b, i) => (
                <div key={`tax-${b.rate_pct}-${i}`} className="text-[11px] text-brand-text-secondary flex justify-between">
                  <span>{b.rate_pct}%</span><span>${b.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          {quote.tip > 0 && <Row testid="preview-tip" label="Tip" value={`$${quote.tip.toFixed(2)}`} />}
          <div className="border-t border-brand-border pt-2 mt-2 font-heading font-bold text-brand-text flex justify-between" data-testid="preview-total">
            <span>Total</span><span>${quote.total.toFixed(2)}</span>
          </div>
          {quote.delivery_blocked && (
            <p data-testid="preview-min-order-warning" className="mt-2 text-[11px] text-amber-800 bg-amber-50 rounded p-2">
              Cart is below ${quote.min_order.toFixed(2)} minimum for delivery.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, testid, sub }) {
  return (
    <div data-testid={testid} className={`flex justify-between ${sub ? "text-brand-text-secondary text-xs" : "text-brand-text"}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

/* ─── Tax Report ──────────────────────────────────── */
function TaxReportCard({ regionId }) {
  const now = new Date();
  const start0 = new Date(now.getTime() - 90 * 86400000);
  const [start, setStart] = useState(start0.toISOString().slice(0, 10));
  const [end, setEnd] = useState(now.toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const url = `${API}/admin/fees/tax-report?start=${start}T00:00:00Z&end=${end}T23:59:59Z&region_id=${regionId}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tax_report_${start}_${end}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Tax report downloaded");
    } catch (e) {
      toast.error("Download failed", { description: e.message });
    } finally { setBusy(false); }
  };

  return (
    <Card title="Tax reporting export" icon={Download}>
      <p className="text-xs text-brand-text-secondary mb-3">CSV summary for your accountant — breakdown by tax rate and category.</p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
        <Field label="From"><Input data-testid="taxreport-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="To"><Input data-testid="taxreport-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        <div className="sm:self-end">
          <button
            data-testid="taxreport-download-btn"
            onClick={download}
            disabled={busy}
            className="h-10 inline-flex items-center gap-1.5 px-5 bg-brand-primary text-white text-sm font-body font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download CSV
          </button>
        </div>
      </div>
    </Card>
  );
}
