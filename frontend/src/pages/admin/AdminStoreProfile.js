import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, MapPin, Plus, Trash2, Star, CheckCircle2, Circle, ExternalLink, RefreshCcw, LogOut, PlugZap, Receipt, Mail, Phone, Edit2, X, Save, Building2, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStorefront } from "@/hooks/useStorefront";

const API = "/api";

export default function AdminStoreProfile() {
  return (
    <div data-testid="admin-store-profile-page" className="p-6 lg:p-10 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">Store profile</h1>
        <p className="font-body text-sm text-brand-text-secondary mt-1">Locations, Google Business sync, receipt preview, and profile completion checklist.</p>
      </div>

      <CompletionCard />
      <div id="locations" className="scroll-mt-24"><LocationsCard /></div>
      <div id="gbp" className="scroll-mt-24"><GoogleBusinessCard /></div>
      <BrandingPreviewCard />
    </div>
  );
}

function SectionCard({ title, subtitle, icon: Icon, children, right }) {
  return (
    <section className="mb-8">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2">
            {Icon && <Icon size={16} className="text-brand-primary" />} {title}
          </h2>
          {subtitle && <p className="font-body text-xs text-brand-text-secondary mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">{children}</div>
    </section>
  );
}

/* ─── Completion Checklist ─────────────────────────── */
function CompletionCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = () => axios.get(`${API}/admin/store/profile-completion`, { withCredentials: true })
    .then(({ data }) => setData(data))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    // Refetch every 30s so onboarding feels live as the admin saves data
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <SectionCard
      title="Profile completion"
      subtitle="Finish these to unlock your full storefront and improve discoverability."
      icon={CheckCircle2}
      right={
        <button data-testid="completion-refresh" onClick={load} className="text-[11px] text-brand-text-secondary hover:text-brand-primary inline-flex items-center gap-1"><RefreshCcw size={11} /> Refresh</button>
      }
    >
      {loading || !data ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-brand-primary" /></div>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
            <div>
              <div data-testid="completion-percent" className="font-heading text-3xl font-bold text-brand-text">{data.percent}%</div>
              <div className="text-xs text-brand-text-secondary">{data.complete_count} of {data.total_count} complete</div>
            </div>
          </div>
          <div data-testid="completion-progress" className="h-2.5 rounded-full bg-brand-bg overflow-hidden">
            <div className="h-full bg-brand-primary transition-[width] duration-500" style={{ width: `${data.percent}%` }} />
          </div>
          <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="completion-items">
            {data.items.map((it) => (
              <li key={it.key} data-testid={`completion-item-${it.key.replace(/\./g, "-")}`} className={`flex items-center gap-2 p-2 rounded-lg border ${it.complete ? "border-green-200 bg-green-50" : "border-brand-border bg-brand-bg"}`}>
                {it.complete ? <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" /> : <Circle size={14} className="text-brand-text-secondary flex-shrink-0" />}
                <span className={`font-body text-sm flex-1 ${it.complete ? "text-green-800 line-through" : "text-brand-text"}`}>{it.label}</span>
                {!it.complete && (
                  <Link to={it.link} data-testid={`completion-link-${it.key.replace(/\./g, "-")}`} className="text-[11px] font-semibold text-brand-primary hover:underline inline-flex items-center gap-1">
                    Complete <ExternalLink size={10} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

/* ─── Multi-location ──────────────────────────────── */
function LocationsCard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = () => axios.get(`${API}/admin/store/locations`, { withCredentials: true })
    .then(({ data }) => setItems(data.locations || []))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const startCreate = () => setEditing({ name: "", address: "", phone: "", email: "", hours: {}, is_primary: items.length === 0, notes: "" });

  const remove = async (loc) => {
    if (!window.confirm(`Delete ${loc.name}?`)) return;
    try {
      await axios.delete(`${API}/admin/store/locations/${loc.id}`, { withCredentials: true });
      toast.success("Location removed"); load();
    } catch { toast.error("Delete failed"); }
  };

  const save = async (payload) => {
    try {
      if (payload.id) {
        const body = { ...payload }; delete body.id; delete body.created_at; delete body.updated_at;
        await axios.patch(`${API}/admin/store/locations/${payload.id}`, body, { withCredentials: true });
      } else {
        await axios.post(`${API}/admin/store/locations`, payload, { withCredentials: true });
      }
      toast.success("Saved");
      setEditing(null); load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    }
  };

  return (
    <SectionCard
      title="Locations"
      subtitle="Each location inherits the global brand identity — override only address, phone, email, and hours."
      icon={MapPin}
      right={
        <button data-testid="add-location-btn" onClick={startCreate} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-brand-primary text-white text-xs font-body font-semibold hover:bg-brand-primary-hover">
          <Plus size={12} /> Add location
        </button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-brand-primary" /></div>
      ) : items.length === 0 && !editing ? (
        <div data-testid="locations-empty" className="text-center py-10">
          <Building2 size={32} className="mx-auto text-brand-text-secondary mb-2" />
          <div className="font-heading text-lg font-bold text-brand-text">No locations yet</div>
          <p className="font-body text-xs text-brand-text-secondary mt-1">Add your first venue — required to accept orders for that address.</p>
          <button data-testid="first-location-btn" onClick={startCreate} className="mt-4 inline-flex items-center gap-1 px-4 py-2 rounded-full bg-brand-primary text-white text-sm font-body font-semibold hover:bg-brand-primary-hover">
            <Plus size={12} /> Add your first location
          </button>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="locations-list">
          {items.map((l) => (
            <LocationRow key={l.id} loc={l} onEdit={() => setEditing(l)} onRemove={() => remove(l)} />
          ))}
        </ul>
      )}

      {editing && (
        <LocationForm
          value={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </SectionCard>
  );
}

function LocationRow({ loc, onEdit, onRemove }) {
  const hoursText = Object.entries(loc.hours || {}).slice(0, 3).map(([d, v]) => `${d}: ${v}`).join(" · ");
  return (
    <li data-testid={`location-row-${loc.id}`} className="border border-brand-border rounded-xl p-3 bg-brand-bg flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0">
        <MapPin size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-heading text-sm font-bold text-brand-text">{loc.name || "Untitled"}</span>
          {loc.is_primary && <span data-testid={`primary-badge-${loc.id}`} className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-body font-bold uppercase tracking-wider inline-flex items-center gap-0.5"><Star size={8} /> Primary</span>}
        </div>
        <div className="text-xs text-brand-text-secondary mt-0.5 truncate">{loc.address || "—"}</div>
        <div className="text-[11px] text-brand-text-secondary mt-0.5 flex items-center gap-3 flex-wrap">
          {loc.phone && <span className="inline-flex items-center gap-1"><Phone size={10} /> {loc.phone}</span>}
          {loc.email && <span className="inline-flex items-center gap-1"><Mail size={10} /> {loc.email}</span>}
          {hoursText && <span className="truncate">{hoursText}</span>}
        </div>
      </div>
      <button data-testid={`location-edit-${loc.id}`} onClick={onEdit} className="p-1.5 rounded-md text-brand-text-secondary hover:bg-white" aria-label="Edit"><Edit2 size={13} /></button>
      <button data-testid={`location-delete-${loc.id}`} onClick={onRemove} className="p-1.5 rounded-md text-brand-text-secondary hover:text-red-600 hover:bg-red-50" aria-label="Delete"><Trash2 size={13} /></button>
    </li>
  );
}

function LocationForm({ value, onChange, onCancel, onSave }) {
  const isEdit = !!value.id;
  return (
    <div data-testid="location-form" className="mt-4 p-4 border border-brand-primary/40 rounded-xl bg-brand-primary/5">
      <div className="flex items-center justify-between mb-3">
        <div className="font-heading text-sm font-bold text-brand-text">{isEdit ? "Edit location" : "New location"}</div>
        <button type="button" onClick={onCancel} className="text-brand-text-secondary hover:text-brand-primary" aria-label="Close"><X size={14} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Name</Label>
          <Input data-testid="location-name-input" value={value.name || ""} onChange={(e) => onChange({ ...value, name: e.target.value })} />
        </div>
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Phone</Label>
          <Input data-testid="location-phone-input" value={value.phone || ""} onChange={(e) => onChange({ ...value, phone: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Address</Label>
          <Input data-testid="location-address-input" value={value.address || ""} onChange={(e) => onChange({ ...value, address: e.target.value })} />
        </div>
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Email</Label>
          <Input data-testid="location-email-input" value={value.email || ""} onChange={(e) => onChange({ ...value, email: e.target.value })} />
        </div>
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Primary location</Label>
          <label className="flex items-center gap-2 h-10">
            <input data-testid="location-primary-checkbox" type="checkbox" checked={!!value.is_primary} onChange={(e) => onChange({ ...value, is_primary: e.target.checked })} className="rounded" />
            <span className="text-xs text-brand-text">Set as primary</span>
          </label>
        </div>
        <div className="sm:col-span-2">
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Hours (JSON — e.g. &#123;"mon":"09:00-21:00"&#125;)</Label>
          <Textarea
            data-testid="location-hours-input"
            rows={2}
            value={JSON.stringify(value.hours || {}, null, 0)}
            onChange={(e) => {
              try { onChange({ ...value, hours: JSON.parse(e.target.value || "{}") }); }
              catch { /* ignore invalid JSON until parseable */ }
            }}
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Internal notes</Label>
          <Textarea data-testid="location-notes-input" rows={2} value={value.notes || ""} onChange={(e) => onChange({ ...value, notes: e.target.value })} />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 border border-brand-border rounded-full text-xs font-body font-semibold">Cancel</button>
        <button
          type="button"
          data-testid="location-save-btn"
          disabled={!value.name || !value.address}
          onClick={() => onSave(value)}
          className="inline-flex items-center gap-1 px-4 py-1.5 bg-brand-primary text-white rounded-full text-xs font-body font-semibold hover:bg-brand-primary-hover disabled:opacity-50"
        >
          <Save size={11} /> Save location
        </button>
      </div>
    </div>
  );
}

/* ─── Google Business Profile ─────────────────────── */
function GoogleBusinessCard() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emailDraft, setEmailDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => axios.get(`${API}/admin/store/google-business`, { withCredentials: true })
    .then(({ data }) => { setState(data); if (data.account_email) setEmailDraft(data.account_email); })
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const connect = async () => {
    if (!emailDraft || !/\S+@\S+\.\S+/.test(emailDraft)) { toast.error("Enter a valid Google account email"); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/admin/store/google-business/connect`, { account_email: emailDraft }, { withCredentials: true });
      toast.success("Connected — MOCKED OAuth");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Connection failed"); }
    finally { setBusy(false); }
  };

  const sync = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/admin/store/google-business/sync`, {}, { withCredentials: true });
      toast.success(`Synced: ${(data.synced_fields || []).join(", ")}`);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Sync failed"); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!window.confirm("Disconnect Google Business Profile?")) return;
    await axios.post(`${API}/admin/store/google-business/disconnect`, {}, { withCredentials: true });
    toast.success("Disconnected"); load();
  };

  return (
    <SectionCard
      title="Google Business Profile"
      subtitle="Keep your Google listing in sync with your store name, address, phone, and menu link."
      icon={PlugZap}
      right={<span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-body font-bold uppercase tracking-wider"><Info size={10} /> OAuth MOCKED</span>}
    >
      {loading || !state ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-brand-primary" /></div>
      ) : state.connected ? (
        <div data-testid="gbp-connected">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center"><CheckCircle2 size={18} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-heading text-sm font-bold text-brand-text">Connected as <span data-testid="gbp-account">{state.account_email}</span></div>
              <div className="text-xs text-brand-text-secondary mt-0.5">
                Location ID: <span className="font-mono">{state.gbp_location_id}</span>
              </div>
              <div className="text-xs text-brand-text-secondary mt-0.5">
                Last synced: <span data-testid="gbp-last-synced">{state.last_synced_at ? new Date(state.last_synced_at).toLocaleString() : "never"}</span>
                {state.last_sync_status && <> · status: <span className={state.last_sync_status === "ok" ? "text-green-700" : "text-red-700"}>{state.last_sync_status}</span></>}
              </div>
              {state.synced_fields?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1" data-testid="gbp-synced-fields">
                  {state.synced_fields.map((f) => (
                    <span key={f} className="px-1.5 py-0.5 rounded-full bg-brand-bg text-[10px] font-body font-semibold text-brand-text-secondary capitalize">{f.replace(/_/g, " ")}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button data-testid="gbp-sync-btn" onClick={sync} disabled={busy} className="inline-flex items-center gap-1 px-4 py-1.5 bg-brand-primary text-white rounded-full text-xs font-body font-semibold hover:bg-brand-primary-hover disabled:opacity-50">
              {busy ? <Loader2 size={11} className="animate-spin" /> : <RefreshCcw size={11} />} Sync now
            </button>
            <button data-testid="gbp-disconnect-btn" onClick={disconnect} className="inline-flex items-center gap-1 px-4 py-1.5 border border-brand-border rounded-full text-xs font-body font-semibold hover:border-red-300 hover:text-red-700">
              <LogOut size={11} /> Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div data-testid="gbp-disconnected">
          <p className="font-body text-sm text-brand-text-secondary mb-3">
            Connect your Google account to publish store name, hours, address, and menu link to your Google Business listing.
          </p>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1">Google account email</Label>
              <Input data-testid="gbp-email-input" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} placeholder="owner@gmail.com" />
            </div>
            <button data-testid="gbp-connect-btn" onClick={connect} disabled={busy} className="inline-flex items-center gap-1 h-10 px-4 bg-brand-primary text-white rounded-full text-sm font-body font-semibold hover:bg-brand-primary-hover disabled:opacity-50">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <PlugZap size={13} />} Connect
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

/* ─── Receipt & Email Branding Preview ───────────── */
function BrandingPreviewCard() {
  const s = useStorefront();
  const [tab, setTab] = useState("receipt");
  const primary = s?.colors?.primary || "#6E1C1E";
  const logoUrl = s?.logo_url;
  const brand = s?.brand_name || "Your Restaurant";
  const address = s?.contact?.address || "—";
  const phone = s?.contact?.phone || "—";

  const sample = useMemo(() => ({
    order_number: "#CE2041",
    date: new Date().toLocaleString(),
    items: [
      { qty: 1, name: "Heritage Duck Breast", price: 42 },
      { qty: 2, name: "Seasonal Focaccia", price: 9 },
      { qty: 1, name: "Hazelnut Ganache Tart", price: 14 },
    ],
    subtotal: 74, tax: 6.29, total: 80.29,
  }), []);

  return (
    <SectionCard title="Receipt & email branding" subtitle="Preview how your brand appears on customer touchpoints." icon={Receipt}>
      <div className="flex gap-2 mb-4" data-testid="branding-preview-tabs">
        <button data-testid="preview-tab-receipt" onClick={() => setTab("receipt")} className={`px-3 py-1 rounded-full text-xs font-body font-semibold ${tab === "receipt" ? "bg-brand-primary text-white" : "bg-brand-bg text-brand-text"}`}>Printed receipt</button>
        <button data-testid="preview-tab-email" onClick={() => setTab("email")} className={`px-3 py-1 rounded-full text-xs font-body font-semibold ${tab === "email" ? "bg-brand-primary text-white" : "bg-brand-bg text-brand-text"}`}>Order email</button>
      </div>

      {tab === "receipt" ? (
        <div data-testid="receipt-preview" className="max-w-xs mx-auto bg-white border border-dashed border-brand-border rounded-md p-4 font-mono text-[11px] text-brand-text shadow-sm">
          <div className="text-center mb-2">
            {logoUrl ? <img src={logoUrl} alt={brand} className="max-h-10 mx-auto mb-1" /> : <div className="font-heading text-sm font-bold" style={{ color: primary }}>{brand}</div>}
            <div className="text-[9px]">{address}</div>
            <div className="text-[9px]">{phone}</div>
          </div>
          <div className="border-t border-dashed border-brand-border my-2" />
          <div className="flex justify-between text-[10px]"><span>Order {sample.order_number}</span><span>{sample.date}</span></div>
          <div className="border-t border-dashed border-brand-border my-2" />
          {sample.items.map((it, i) => (
            <div key={i} className="flex justify-between"><span>{it.qty}× {it.name}</span><span>${(it.qty * it.price).toFixed(2)}</span></div>
          ))}
          <div className="border-t border-dashed border-brand-border my-2" />
          <div className="flex justify-between"><span>Subtotal</span><span>${sample.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>${sample.tax.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold" style={{ color: primary }}><span>TOTAL</span><span>${sample.total.toFixed(2)}</span></div>
          <div className="border-t border-dashed border-brand-border my-2" />
          <div className="text-center text-[9px]">Thank you — see you again soon.</div>
        </div>
      ) : (
        <div data-testid="email-preview" className="max-w-lg mx-auto rounded-xl overflow-hidden border border-brand-border shadow-sm">
          <div className="p-6 text-center" style={{ background: primary, color: "white" }}>
            {logoUrl ? <img src={logoUrl} alt={brand} className="max-h-12 mx-auto mb-2 bg-white/10 rounded p-1" /> : <div className="font-heading text-xl font-bold">{brand}</div>}
            <div className="font-body text-xs opacity-90 mt-1">Your order is confirmed</div>
          </div>
          <div className="p-6 bg-white">
            <div className="text-sm font-body text-brand-text mb-3">Hi {brand === "Your Restaurant" ? "there" : "friend"} — thanks for your order <strong>{sample.order_number}</strong>. Here's what's coming:</div>
            <ul className="border-y border-brand-border divide-y divide-brand-border">
              {sample.items.map((it, i) => (
                <li key={i} className="flex justify-between py-2 text-sm">
                  <span className="text-brand-text">{it.qty}× {it.name}</span>
                  <span className="text-brand-text-secondary">${(it.qty * it.price).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between mt-3 font-heading text-base font-bold" style={{ color: primary }}>
              <span>Total</span><span>${sample.total.toFixed(2)}</span>
            </div>
            <a
              href="#"
              className="mt-5 block text-center px-5 py-2.5 rounded-full text-white font-body text-sm font-semibold"
              style={{ background: primary }}
              onClick={(e) => e.preventDefault()}
            >
              Track your order
            </a>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
