import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Loader2, Search as SearchIcon, X, Ban, CheckCircle2, History,
  RotateCcw, Zap, AlertOctagon, Settings,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

const API = "/api";

const STATUS_META = {
  in_stock: { label: "Available", cls: "bg-green-100 text-green-700 border-green-200" },
  sold_out: { label: "Sold Out", cls: "bg-red-100 text-red-700 border-red-200" },
  seasonal: { label: "Seasonal", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  hidden: { label: "Hidden", cls: "bg-gray-200 text-gray-700 border-gray-300" },
};

function fmtTime(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

export default function AdminEightySix() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [selected, setSelected] = useState(() => new Set());
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState(null);

  const load = async () => {
    try {
      const [{ data: mi }, { data: ct }, { data: lg }, { data: st }] = await Promise.all([
        axios.get(`${API}/menu/items`),
        axios.get(`${API}/menu/categories`),
        axios.get(`${API}/admin/86/log?limit=30`, { withCredentials: true }),
        axios.get(`${API}/admin/86/settings`, { withCredentials: true }),
      ]);
      setItems(mi.items || []);
      setCategories(ct.categories || []);
      setLogs(lg.logs || []);
      setSettings(st);
    } catch { toast.error("Could not load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (catFilter !== "all") list = list.filter((i) => i.category === catFilter);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((i) => (i.name || "").toLowerCase().includes(needle) || (i.description || "").toLowerCase().includes(needle));
    }
    return list;
  }, [items, q, catFilter]);

  const toggleItem = async (id) => {
    try {
      const { data } = await axios.post(`${API}/admin/86/items/${id}/toggle`, { source: "admin_86" }, { withCredentials: true });
      toast.success(`${data.name} → ${STATUS_META[data.status]?.label || data.status}`);
      load();
    } catch { toast.error("Toggle failed"); }
  };

  const toggleSelect = (id) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearSel = () => setSelected(new Set());
  const selectAllFiltered = () => setSelected(new Set(filtered.map((i) => i.id)));

  const batchSet = async (status) => {
    if (selected.size === 0) return;
    try {
      const { data } = await axios.post(`${API}/admin/86/batch`, { item_ids: [...selected], status, source: "batch" }, { withCredentials: true });
      toast.success(`${data.updated} items → ${STATUS_META[status]?.label}`);
      clearSel(); load();
    } catch { toast.error("Batch failed"); }
  };

  const batchCategory = async (cat, status) => {
    try {
      const { data } = await axios.post(`${API}/admin/86/batch`, { category: cat, status, source: "batch_category" }, { withCredentials: true });
      toast.success(`${cat}: ${data.updated} items → ${STATUS_META[status]?.label}`);
      load();
    } catch { toast.error("Batch failed"); }
  };

  const toggleAutoRestore = async (v) => {
    try {
      const { data } = await axios.patch(`${API}/admin/86/settings`, { auto_restore_on_open: v }, { withCredentials: true });
      setSettings(data);
      toast.success(v ? "Auto-restore enabled" : "Auto-restore disabled");
    } catch { toast.error("Could not save"); }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 size={28} className="animate-spin text-brand-primary" /></div>;

  return (
    <div data-testid="admin-86-page" className="p-6 sm:p-10 max-w-6xl">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-brand-text inline-flex items-center gap-2">
            <Ban size={24} className="text-red-600" /> 86 Management
          </h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">Instantly mark items unavailable on the storefront. Restores automatically at next open if enabled.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-brand-border rounded-xl p-2.5 pr-3">
          <Settings size={14} className="text-brand-text-secondary" />
          <span className="text-xs font-body text-brand-text">Auto-restore at next open</span>
          <Switch
            data-testid="auto-restore-switch"
            checked={!!settings?.auto_restore_on_open}
            onCheckedChange={toggleAutoRestore}
          />
        </div>
      </div>

      {/* Search + category filter + batch-by-category */}
      <section className="bg-white border border-brand-border rounded-xl p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
            <input
              data-testid="86-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search item name…"
              className="w-full pl-8 pr-8 h-9 rounded-full border border-brand-border bg-brand-surface focus:bg-white focus:border-brand-primary/60 text-sm outline-none"
            />
            {q && <button onClick={() => setQ("")} data-testid="86-search-clear" className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-secondary"><X size={14} /></button>}
          </div>
          <div className="inline-flex flex-wrap gap-1 rounded-full border border-brand-border p-1 bg-brand-surface">
            {["all", ...categories].map((c) => (
              <button
                key={c}
                data-testid={`86-filter-${c}`}
                onClick={() => setCatFilter(c)}
                className={`px-3 py-1 text-xs font-semibold rounded-full capitalize transition ${catFilter === c ? "bg-brand-primary text-white" : "text-brand-text-secondary"}`}
              >{c}</button>
            ))}
          </div>
        </div>
        {catFilter !== "all" && (
          <div className="flex items-center gap-2 text-xs mb-1" data-testid="category-batch-row">
            <AlertOctagon size={12} className="text-red-600" />
            <span className="text-brand-text-secondary">Quick batch for <span className="font-semibold capitalize">{catFilter}</span>:</span>
            <button
              data-testid={`batch-category-86-${catFilter}`}
              onClick={() => batchCategory(catFilter, "sold_out")}
              className="px-3 py-1 rounded-full bg-red-600 text-white text-[11px] font-bold hover:bg-red-700"
            >86 all {catFilter}</button>
            <button
              data-testid={`batch-category-restore-${catFilter}`}
              onClick={() => batchCategory(catFilter, "in_stock")}
              className="px-3 py-1 rounded-full bg-green-600 text-white text-[11px] font-bold hover:bg-green-700"
            >Restore all</button>
          </div>
        )}
      </section>

      {/* Batch bar */}
      {selected.size > 0 && (
        <div data-testid="86-batch-bar" className="sticky top-0 z-10 bg-brand-primary text-white rounded-lg px-4 py-2.5 mb-3 flex items-center justify-between">
          <span className="font-body text-sm font-semibold">{selected.size} selected</span>
          <div className="flex items-center gap-2 text-xs">
            <button onClick={selectAllFiltered} data-testid="select-all-filtered-btn" className="underline">Select all in view ({filtered.length})</button>
            <button onClick={clearSel} data-testid="clear-selection-btn" className="underline">Clear</button>
            <button data-testid="batch-86-btn" onClick={() => batchSet("sold_out")} className="inline-flex items-center gap-1 bg-white text-red-700 px-3 py-1 rounded-full font-bold"><Ban size={12} /> 86 all</button>
            <button data-testid="batch-restore-btn" onClick={() => batchSet("in_stock")} className="inline-flex items-center gap-1 bg-white text-green-700 px-3 py-1 rounded-full font-bold"><CheckCircle2 size={12} /> Restore</button>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="bg-white border border-brand-border rounded-xl overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-surface text-left">
              <tr>
                <th className="p-3 w-6"></th>
                <th className="p-3 font-semibold">Item</th>
                <th className="p-3 font-semibold">Category</th>
                <th className="p-3 font-semibold">Price</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-brand-text-secondary text-sm">No items match your filters.</td></tr>
              ) : filtered.map((i) => {
                const meta = STATUS_META[i.status] || STATUS_META.in_stock;
                const isSold = i.status === "sold_out";
                return (
                  <tr key={i.id} data-testid={`86-row-${i.id}`} className={`border-t border-brand-border ${isSold ? "bg-red-50/30" : ""}`}>
                    <td className="p-3"><input type="checkbox" data-testid={`86-select-${i.id}`} checked={selected.has(i.id)} onChange={() => toggleSelect(i.id)} className="accent-brand-primary w-4 h-4" /></td>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        {i.image ? <img src={i.image} alt="" className="w-10 h-10 object-cover rounded-md" /> : <div className="w-10 h-10 bg-brand-surface rounded-md" />}
                        <div>
                          <div className={`font-semibold ${isSold ? "line-through text-brand-text-secondary" : "text-brand-text"}`}>{i.name}</div>
                          <div className="text-[10px] text-brand-text-secondary truncate max-w-xs">{i.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 capitalize text-xs">{i.category}</td>
                    <td className="p-3 text-xs">${(i.price || 0).toFixed(2)}</td>
                    <td className="p-3">
                      <span data-testid={`86-status-${i.id}`} className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="p-3 text-right">
                      {isSold ? (
                        <button
                          data-testid={`86-restore-${i.id}`}
                          onClick={() => toggleItem(i.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-full hover:bg-green-700"
                        ><RotateCcw size={12} /> Restore</button>
                      ) : (
                        <button
                          data-testid={`86-toggle-${i.id}`}
                          onClick={() => toggleItem(i.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-full hover:bg-red-700"
                        ><Ban size={12} /> 86</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* History log */}
      <section className="bg-white border border-brand-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-brand-border">
          <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2">
            <History size={16} className="text-brand-primary" /> 86 History
          </h2>
          <button onClick={load} className="text-xs text-brand-text-secondary hover:text-brand-primary" data-testid="86-refresh-log">Refresh</button>
        </div>
        {logs.length === 0 ? (
          <div className="p-6 text-sm text-brand-text-secondary text-center">No activity yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="86-log-table">
              <thead className="bg-brand-surface text-left">
                <tr>
                  <th className="p-3 font-semibold">When</th>
                  <th className="p-3 font-semibold">Item</th>
                  <th className="p-3 font-semibold">Change</th>
                  <th className="p-3 font-semibold">By</th>
                  <th className="p-3 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} data-testid={`86-log-${l.id}`} className="border-t border-brand-border">
                    <td className="p-3 whitespace-nowrap">{fmtTime(l.created_at)}</td>
                    <td className="p-3"><span className="font-semibold">{l.item_name}</span><span className="text-[10px] text-brand-text-secondary ml-1 capitalize">{l.category}</span></td>
                    <td className="p-3">
                      <span className="text-xs">
                        <span className="capitalize">{(l.prev_status || "").replace("_", " ")}</span> → <span className={`font-semibold capitalize ${l.new_status === "sold_out" ? "text-red-700" : "text-green-700"}`}>{(l.new_status || "").replace("_", " ")}</span>
                      </span>
                    </td>
                    <td className="p-3 text-xs">{l.actor_name || "—"}</td>
                    <td className="p-3 text-xs text-brand-text-secondary">{l.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
