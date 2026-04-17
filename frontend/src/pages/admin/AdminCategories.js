import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye, EyeOff, GripVertical, ChevronRight, FolderTree } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import axios from "axios";

const API_BASE = "/api";

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [dragItem, setDragItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);

  const fetchCategories = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/categories`, { withCredentials: true });
      setCategories(data.categories || []);
    } catch (e) {
      console.error("Failed to fetch categories", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const topLevel = categories.filter(c => !c.parent_id).sort((a, b) => a.display_order - b.display_order);
  const getSubcategories = (parentId) => categories.filter(c => c.parent_id === parentId).sort((a, b) => a.display_order - b.display_order);

  const handleToggle = async (catId) => {
    try {
      const { data } = await axios.patch(`${API_BASE}/admin/categories/${catId}/toggle`, {}, { withCredentials: true });
      setCategories(prev => prev.map(c => c.id === catId ? data : c));
    } catch (e) {
      console.error("Toggle failed", e);
    }
  };

  const handleDelete = async (catId) => {
    if (deleting === catId) {
      try {
        await axios.delete(`${API_BASE}/admin/categories/${catId}`, { withCredentials: true });
        setCategories(prev => prev.filter(c => c.id !== catId && c.parent_id !== catId));
      } catch (e) {
        console.error("Delete failed", e);
      }
      setDeleting(null);
    } else {
      setDeleting(catId);
      setTimeout(() => setDeleting(null), 3000);
    }
  };

  const handleDragStart = (catId) => setDragItem(catId);
  const handleDragOver = (e, catId) => { e.preventDefault(); setDragOverItem(catId); };
  const handleDrop = async (targetId) => {
    if (!dragItem || dragItem === targetId) { setDragItem(null); setDragOverItem(null); return; }
    const dragCat = categories.find(c => c.id === dragItem);
    const targetCat = categories.find(c => c.id === targetId);
    if (!dragCat || !targetCat || dragCat.parent_id !== targetCat.parent_id) { setDragItem(null); setDragOverItem(null); return; }
    const siblings = categories.filter(c => c.parent_id === dragCat.parent_id).sort((a, b) => a.display_order - b.display_order);
    const fromIdx = siblings.findIndex(c => c.id === dragItem);
    const toIdx = siblings.findIndex(c => c.id === targetId);
    const reordered = [...siblings];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const reorderItems = reordered.map((c, i) => ({ id: c.id, display_order: i }));
    try {
      await axios.post(`${API_BASE}/admin/categories/reorder`, { items: reorderItems }, { withCredentials: true });
      setCategories(prev => prev.map(c => {
        const reorderItem = reorderItems.find(r => r.id === c.id);
        return reorderItem ? { ...c, display_order: reorderItem.display_order } : c;
      }));
    } catch (e) {
      console.error("Reorder failed", e);
    }
    setDragItem(null);
    setDragOverItem(null);
  };

  const renderCategoryRow = (cat, isSubcategory = false) => {
    const subs = getSubcategories(cat.id);
    return (
      <div key={cat.id}>
        <div
          data-testid={`cat-row-${cat.id}`}
          draggable
          onDragStart={() => handleDragStart(cat.id)}
          onDragOver={(e) => handleDragOver(e, cat.id)}
          onDrop={() => handleDrop(cat.id)}
          className={`flex items-center gap-3 px-4 py-3 border-b border-brand-border hover:bg-brand-bg/30 transition-colors ${isSubcategory ? "pl-12" : ""} ${dragOverItem === cat.id ? "bg-brand-orange/5 border-brand-orange" : ""}`}
        >
          <GripVertical size={14} className="text-brand-text-secondary cursor-grab flex-shrink-0" data-testid={`drag-handle-${cat.id}`} />
          {cat.image ? (
            <img src={cat.image} alt={cat.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-brand-bg border border-brand-border flex items-center justify-center flex-shrink-0">
              <FolderTree size={14} className="text-brand-text-secondary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isSubcategory && <ChevronRight size={12} className="text-brand-text-secondary flex-shrink-0" />}
              <p className={`font-heading text-sm font-bold truncate ${cat.visible === false ? "text-brand-text-secondary" : "text-brand-text"}`}>{cat.name}</p>
              <span className="px-2 py-0.5 bg-brand-bg text-brand-text-secondary text-[9px] font-body font-medium uppercase tracking-wider rounded">{cat.slug}</span>
            </div>
            {cat.description && <p className="font-body text-[10px] text-brand-text-secondary truncate max-w-[300px] mt-0.5">{cat.description}</p>}
          </div>
          {!isSubcategory && subs.length > 0 && (
            <span className="px-2 py-0.5 bg-brand-orange/10 text-brand-orange text-[9px] font-body font-semibold rounded flex-shrink-0">
              {subs.length} sub
            </span>
          )}
          <Switch data-testid={`cat-toggle-${cat.id}`} checked={cat.visible !== false} onCheckedChange={() => handleToggle(cat.id)} />
          <Link to={`/admin/categories/${cat.id}/edit`} data-testid={`cat-edit-${cat.id}`} className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-text-secondary hover:text-brand-primary hover:bg-brand-bg transition-colors">
            <Pencil size={14} />
          </Link>
          <button
            data-testid={`cat-delete-${cat.id}`}
            onClick={() => handleDelete(cat.id)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${deleting === cat.id ? "bg-red-500 text-white" : "text-brand-text-secondary hover:text-red-500 hover:bg-red-50"}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
        {subs.map(sub => renderCategoryRow(sub, true))}
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 data-testid="categories-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text tracking-tight">Category Management</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">{topLevel.length} categories, {categories.length - topLevel.length} subcategories</p>
        </div>
        <Link to="/admin/categories/new" data-testid="add-category-btn" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white font-body text-sm font-medium rounded-lg hover:bg-brand-primary-hover transition-colors">
          <Plus size={16} /> Add Category
        </Link>
      </div>

      <p className="font-body text-xs text-brand-text-secondary mb-4">Drag and drop to reorder categories. Subcategories are nested under their parent.</p>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div data-testid="categories-list" className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
          <div className="border-b border-brand-border bg-brand-bg/50 px-4 py-3 flex items-center gap-3">
            <div className="w-[14px]" />
            <div className="w-10" />
            <span className="flex-1 font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Category</span>
            <span className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary w-16 text-center">Visible</span>
            <span className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary w-20 text-right">Actions</span>
          </div>
          {topLevel.length === 0 ? (
            <div className="px-4 py-12 text-center font-body text-sm text-brand-text-secondary">No categories yet. Create your first category!</div>
          ) : (
            topLevel.map(cat => renderCategoryRow(cat))
          )}
        </div>
      )}
    </div>
  );
}
