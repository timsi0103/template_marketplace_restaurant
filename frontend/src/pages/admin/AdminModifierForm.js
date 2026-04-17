import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import axios from "axios";

const API_BASE = "/api";

export default function AdminModifierForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({ name: "", type: "optional", min_selections: 0, max_selections: 0, options: [{ id: "", name: "", price_adjustment: 0 }], linked_item_ids: [] });
  const [menuItems, setMenuItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const itemsResp = await axios.get(`${API_BASE}/menu/items`, { withCredentials: true });
        setMenuItems(itemsResp.data.items || []);
        if (isEdit) {
          const modResp = await axios.get(`${API_BASE}/modifiers`, { withCredentials: true });
          const group = (modResp.data.groups || []).find(g => g.id === id);
          if (group) {
            setForm({
              name: group.name || "", type: group.type || "optional",
              min_selections: group.min_selections || 0, max_selections: group.max_selections || 0,
              options: group.options?.length > 0 ? group.options.map(o => ({ id: o.id, name: o.name, price_adjustment: o.price_adjustment })) : [{ id: "", name: "", price_adjustment: 0 }],
              linked_item_ids: group.linked_item_ids || [],
            });
          } else { setError("Modifier group not found"); }
        }
      } catch { setError("Failed to load data"); }
      finally { setLoadingData(false); }
    };
    load();
  }, [id, isEdit]);

  const addOption = () => setForm(p => ({ ...p, options: [...p.options, { id: "", name: "", price_adjustment: 0 }] }));
  const removeOption = (idx) => setForm(p => ({ ...p, options: p.options.filter((_, i) => i !== idx) }));
  const updateOption = (idx, field, value) => setForm(p => ({ ...p, options: p.options.map((o, i) => i === idx ? { ...o, [field]: value } : o) }));

  const toggleLinkedItem = (itemId) => {
    setForm(p => ({
      ...p,
      linked_item_ids: p.linked_item_ids.includes(itemId)
        ? p.linked_item_ids.filter(i => i !== itemId)
        : [...p.linked_item_ids, itemId],
    }));
  };

  const selectAllItems = () => setForm(p => ({ ...p, linked_item_ids: menuItems.map(i => i.id) }));
  const clearAllItems = () => setForm(p => ({ ...p, linked_item_ids: [] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Group name is required"); return; }
    const validOptions = form.options.filter(o => o.name.trim());
    if (validOptions.length === 0) { setError("At least one option is required"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(), type: form.type,
      min_selections: form.type === "required" ? Math.max(1, Number(form.min_selections) || 1) : Number(form.min_selections) || 0,
      max_selections: Number(form.max_selections) || 0,
      options: validOptions.map(o => ({ id: o.id, name: o.name.trim(), price_adjustment: Number(o.price_adjustment) || 0 })),
      linked_item_ids: form.linked_item_ids,
    };
    try {
      if (isEdit) { await axios.put(`${API_BASE}/admin/modifiers/${id}`, payload, { withCredentials: true }); }
      else { await axios.post(`${API_BASE}/admin/modifiers`, payload, { withCredentials: true }); }
      navigate("/admin/modifiers");
    } catch (err) {
      setError(typeof err.response?.data?.detail === "string" ? err.response.data.detail : "Failed to save");
    } finally { setSaving(false); }
  };

  if (loadingData) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <button data-testid="back-to-modifiers-btn" onClick={() => navigate("/admin/modifiers")} className="inline-flex items-center gap-2 font-body text-sm text-brand-text-secondary hover:text-brand-text transition-colors mb-6">
        <ArrowLeft size={16} /> Back to Modifiers
      </button>
      <h1 data-testid="modifier-form-title" className="font-heading text-3xl font-bold text-brand-text tracking-tight mb-8">
        {isEdit ? "Edit Modifier Group" : "Add Modifier Group"}
      </h1>

      {error && <div data-testid="mod-form-error" className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-body rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Group Name</Label>
          <Input data-testid="mod-input-name" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Size, Add-Ons, Temperature" className="bg-brand-bg border-brand-border font-body text-sm h-11" />
        </div>

        {/* Type + Min/Max */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm(p => ({ ...p, type: v, min_selections: v === "required" ? Math.max(1, p.min_selections) : p.min_selections }))}>
              <SelectTrigger data-testid="mod-select-type" className="bg-brand-bg border-brand-border font-body text-sm h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="required">Required</SelectItem>
                <SelectItem value="optional">Optional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Min Selections</Label>
            <Input data-testid="mod-input-min" type="number" min="0" value={form.min_selections} onChange={(e) => setForm(p => ({ ...p, min_selections: e.target.value }))} className="bg-brand-bg border-brand-border font-body text-sm h-11" />
          </div>
          <div>
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Max Selections</Label>
            <Input data-testid="mod-input-max" type="number" min="0" value={form.max_selections} onChange={(e) => setForm(p => ({ ...p, max_selections: e.target.value }))} className="bg-brand-bg border-brand-border font-body text-sm h-11" />
            <p className="font-body text-[10px] text-brand-text-secondary mt-0.5">0 = unlimited</p>
          </div>
        </div>

        {/* Options */}
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-2">Modifier Options</Label>
          <div className="space-y-2">
            {form.options.map((opt, idx) => (
              <div key={idx} data-testid={`mod-option-row-${idx}`} className="flex gap-2 items-center">
                <Input value={opt.name} onChange={(e) => updateOption(idx, "name", e.target.value)} placeholder="Option name" className="bg-brand-bg border-brand-border font-body text-sm h-10 flex-1" />
                <div className="relative w-28">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-xs text-brand-text-secondary">$</span>
                  <Input type="number" step="0.01" value={opt.price_adjustment} onChange={(e) => updateOption(idx, "price_adjustment", e.target.value)} className="bg-brand-bg border-brand-border font-body text-sm h-10 pl-7" />
                </div>
                {form.options.length > 1 && (
                  <button type="button" onClick={() => removeOption(idx)} className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-text-secondary hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" data-testid="add-option-btn" onClick={addOption} className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-brand-bg border border-brand-border rounded-lg font-body text-xs text-brand-text hover:bg-brand-surface transition-colors">
            <Plus size={12} /> Add Option
          </button>
        </div>

        {/* Linked Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Linked Menu Items</Label>
            <div className="flex gap-2">
              <button type="button" data-testid="select-all-items" onClick={selectAllItems} className="font-body text-[10px] text-brand-primary hover:text-brand-primary-hover">Select All</button>
              <button type="button" data-testid="clear-all-items" onClick={clearAllItems} className="font-body text-[10px] text-brand-text-secondary hover:text-brand-text">Clear</button>
            </div>
          </div>
          <div data-testid="linked-items-grid" className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
            {menuItems.map((item) => {
              const linked = form.linked_item_ids.includes(item.id);
              return (
                <button type="button" key={item.id} data-testid={`link-item-${item.id}`} onClick={() => toggleLinkedItem(item.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${linked ? "border-brand-primary bg-brand-primary/5" : "border-brand-border bg-brand-surface hover:bg-brand-bg"}`}
                >
                  <img src={item.image} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  <span className={`font-body text-xs truncate ${linked ? "text-brand-primary font-medium" : "text-brand-text-secondary"}`}>{item.name}</span>
                </button>
              );
            })}
          </div>
          <p className="font-body text-[10px] text-brand-text-secondary mt-1">{form.linked_item_ids.length} items linked</p>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" data-testid="save-modifier-btn" disabled={saving} className="px-8 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : isEdit ? "Update Group" : "Create Group"}
          </button>
          <button type="button" onClick={() => navigate("/admin/modifiers")} className="px-6 py-3 bg-brand-surface border border-brand-border text-brand-text font-body text-sm rounded-full hover:bg-brand-bg transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  );
}
