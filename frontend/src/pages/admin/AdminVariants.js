import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Package, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import axios from "axios";

const API_BASE = "/api";

export default function AdminVariants() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState(null);
  const [editingVariant, setEditingVariant] = useState(null);
  const [varForm, setVarForm] = useState({ name: "", price: "", stock: "-1", image: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE}/menu/items`, { withCredentials: true })
      .then(({ data }) => setItems(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const itemsWithVariants = items.filter(i => i.variants?.length > 0);
  const itemsWithoutVariants = items.filter(i => !i.variants?.length);

  const handleAddVariant = async (itemId) => {
    if (!varForm.name.trim() || !varForm.price) return;
    setSaving(true);
    try {
      const item = items.find(i => i.id === itemId);
      const existingVariants = item.variants || [];
      const newVariant = { id: "", name: varForm.name.trim(), price: parseFloat(varForm.price), stock: parseInt(varForm.stock) || -1, status: parseInt(varForm.stock) === 0 ? "sold_out" : "in_stock", image: varForm.image };
      const { data } = await axios.put(`${API_BASE}/admin/menu/items/${itemId}`, { variants: [...existingVariants, newVariant] }, { withCredentials: true });
      setItems(prev => prev.map(i => i.id === itemId ? data : i));
      setVarForm({ name: "", price: "", stock: "-1", image: "" });
    } catch (e) { console.error("Add variant failed", e); }
    finally { setSaving(false); }
  };

  const handleDeleteVariant = async (itemId, variantId) => {
    try {
      const item = items.find(i => i.id === itemId);
      const newVariants = (item.variants || []).filter(v => v.id !== variantId);
      const { data } = await axios.put(`${API_BASE}/admin/menu/items/${itemId}`, { variants: newVariants }, { withCredentials: true });
      setItems(prev => prev.map(i => i.id === itemId ? data : i));
    } catch (e) { console.error("Delete variant failed", e); }
  };

  const handleEditVariant = async (itemId) => {
    if (!varForm.name.trim() || !varForm.price) return;
    setSaving(true);
    try {
      const item = items.find(i => i.id === itemId);
      const newVariants = (item.variants || []).map(v =>
        v.id === editingVariant ? { ...v, name: varForm.name.trim(), price: parseFloat(varForm.price), stock: parseInt(varForm.stock), status: parseInt(varForm.stock) === 0 ? "sold_out" : "in_stock", image: varForm.image } : v
      );
      const { data } = await axios.put(`${API_BASE}/admin/menu/items/${itemId}`, { variants: newVariants }, { withCredentials: true });
      setItems(prev => prev.map(i => i.id === itemId ? data : i));
      setEditingVariant(null);
      setVarForm({ name: "", price: "", stock: "-1", image: "" });
    } catch (e) { console.error("Edit variant failed", e); }
    finally { setSaving(false); }
  };

  const startEdit = (variant) => {
    setEditingVariant(variant.id);
    setVarForm({ name: variant.name, price: String(variant.price), stock: String(variant.stock), image: variant.image || "" });
  };

  return (
    <div className="p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 data-testid="variants-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text tracking-tight">Variant Management</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">{itemsWithVariants.length} items with variants, {itemsWithoutVariants.length} without</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div data-testid="variants-list" className="space-y-3">
          {items.map((item) => {
            const variants = item.variants || [];
            const isExpanded = expandedItem === item.id;
            return (
              <div key={item.id} data-testid={`variant-item-${item.id}`} className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
                {/* Item header */}
                <button onClick={() => setExpandedItem(isExpanded ? null : item.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-bg/30 transition-colors">
                  <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-heading text-sm font-bold text-brand-text truncate">{item.name}</p>
                    <p className="font-body text-[10px] text-brand-text-secondary">{item.category} &middot; ${item.price?.toFixed(2)}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[9px] font-body font-semibold rounded ${variants.length > 0 ? "bg-brand-primary/10 text-brand-primary" : "bg-brand-bg text-brand-text-secondary"}`}>
                    {variants.length} variant{variants.length !== 1 ? "s" : ""}
                  </span>
                  {isExpanded ? <ChevronDown size={16} className="text-brand-text-secondary" /> : <ChevronRight size={16} className="text-brand-text-secondary" />}
                </button>

                {/* Expanded: variants table + add form */}
                {isExpanded && (
                  <div className="border-t border-brand-border">
                    {variants.length > 0 && (
                      <div className="overflow-x-auto -mx-6 px-6"><table className="w-full min-w-[640px]">
                        <thead>
                          <tr className="bg-brand-bg/50">
                            <th className="text-left px-4 py-2 font-body text-[9px] uppercase tracking-widest text-brand-text-secondary">Variant</th>
                            <th className="text-left px-4 py-2 font-body text-[9px] uppercase tracking-widest text-brand-text-secondary">Price</th>
                            <th className="text-left px-4 py-2 font-body text-[9px] uppercase tracking-widest text-brand-text-secondary">Stock</th>
                            <th className="text-left px-4 py-2 font-body text-[9px] uppercase tracking-widest text-brand-text-secondary">Status</th>
                            <th className="text-right px-4 py-2 font-body text-[9px] uppercase tracking-widest text-brand-text-secondary">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variants.map((v) => (
                            <tr key={v.id} data-testid={`variant-row-${v.id}`} className="border-t border-brand-border hover:bg-brand-bg/20 transition-colors">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {v.image && <img src={v.image} alt="" className="w-7 h-7 rounded object-cover" />}
                                  <span className="font-body text-sm font-medium text-brand-text">{v.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5"><span className="font-heading text-sm font-bold text-brand-primary">${v.price?.toFixed(2)}</span></td>
                              <td className="px-4 py-2.5"><span className="font-body text-xs text-brand-text-secondary">{v.stock < 0 ? "Unlimited" : v.stock}</span></td>
                              <td className="px-4 py-2.5">
                                <span className={`px-2 py-0.5 text-[9px] font-body font-semibold uppercase rounded ${v.status === "sold_out" ? "bg-red-50 text-red-600" : v.stock >= 0 && v.stock <= 5 ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"}`}>
                                  {v.status === "sold_out" ? "Sold Out" : v.stock >= 0 && v.stock <= 5 ? "Low Stock" : "In Stock"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center justify-end gap-1">
                                  <button data-testid={`var-edit-${v.id}`} onClick={() => startEdit(v)} className="w-7 h-7 rounded flex items-center justify-center text-brand-text-secondary hover:text-brand-primary hover:bg-brand-bg"><Pencil size={12} /></button>
                                  <button data-testid={`var-delete-${v.id}`} onClick={() => handleDeleteVariant(item.id, v.id)} className="w-7 h-7 rounded flex items-center justify-center text-brand-text-secondary hover:text-red-500 hover:bg-red-50"><Trash2 size={12} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table></div>
                    )}
                    {/* Add/Edit variant form */}
                    <div data-testid={`variant-form-${item.id}`} className="px-4 py-3 bg-brand-bg/30 border-t border-brand-border">
                      <p className="font-body text-xs font-medium text-brand-text mb-2">{editingVariant ? "Edit Variant" : "Add Variant"}</p>
                      <div className="flex gap-2 flex-wrap">
                        <Input value={varForm.name} onChange={(e) => setVarForm(p => ({ ...p, name: e.target.value }))} placeholder="Name (e.g. 500g)" className="bg-brand-surface border-brand-border font-body text-xs h-9 w-32" data-testid={`var-input-name-${item.id}`} />
                        <Input type="number" step="0.01" value={varForm.price} onChange={(e) => setVarForm(p => ({ ...p, price: e.target.value }))} placeholder="Price" className="bg-brand-surface border-brand-border font-body text-xs h-9 w-24" data-testid={`var-input-price-${item.id}`} />
                        <Input type="number" value={varForm.stock} onChange={(e) => setVarForm(p => ({ ...p, stock: e.target.value }))} placeholder="Stock (-1=unlimited)" className="bg-brand-surface border-brand-border font-body text-xs h-9 w-28" data-testid={`var-input-stock-${item.id}`} />
                        <Input value={varForm.image} onChange={(e) => setVarForm(p => ({ ...p, image: e.target.value }))} placeholder="Image URL (optional)" className="bg-brand-surface border-brand-border font-body text-xs h-9 flex-1 min-w-[120px]" data-testid={`var-input-image-${item.id}`} />
                        <button
                          data-testid={`var-save-${item.id}`}
                          onClick={() => editingVariant ? handleEditVariant(item.id) : handleAddVariant(item.id)}
                          disabled={saving}
                          className="px-4 py-1.5 bg-brand-primary text-white font-body text-xs font-medium rounded-lg hover:bg-brand-primary-hover disabled:opacity-50 transition-colors"
                        >
                          {saving ? "..." : editingVariant ? "Update" : "Add"}
                        </button>
                        {editingVariant && (
                          <button onClick={() => { setEditingVariant(null); setVarForm({ name: "", price: "", stock: "-1", image: "" }); }} className="px-3 py-1.5 bg-brand-surface border border-brand-border text-brand-text font-body text-xs rounded-lg">Cancel</button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
