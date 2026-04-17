import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ImagePlus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import axios from "axios";

const API_BASE = "/api";

export default function AdminCategoryForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({ name: "", slug: "", description: "", image: "", parent_id: "none", visible: true });
  const [imageUrl, setImageUrl] = useState("");
  const [parentOptions, setParentOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/categories`, { withCredentials: true });
        const topLevel = (data.categories || []).filter(c => !c.parent_id);
        setParentOptions(topLevel);
        if (isEdit) {
          const cat = (data.categories || []).find(c => c.id === id);
          if (cat) {
            setForm({
              name: cat.name || "", slug: cat.slug || "", description: cat.description || "",
              image: cat.image || "", parent_id: cat.parent_id || "none", visible: cat.visible !== false,
            });
          } else {
            setError("Category not found");
          }
        }
      } catch {
        setError("Failed to load data");
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [id, isEdit]);

  const handleSetImage = () => {
    if (imageUrl.trim()) {
      setForm(p => ({ ...p, image: imageUrl.trim() }));
      setImageUrl("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || form.name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      description: form.description.trim(),
      image: form.image,
      parent_id: form.parent_id === "none" ? null : form.parent_id,
      visible: form.visible,
    };
    try {
      if (isEdit) {
        await axios.put(`${API_BASE}/admin/categories/${id}`, payload, { withCredentials: true });
      } else {
        await axios.post(`${API_BASE}/admin/categories`, payload, { withCredentials: true });
      }
      navigate("/admin/categories");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-6 lg:p-10 max-w-2xl">
      <button data-testid="back-to-categories-btn" onClick={() => navigate("/admin/categories")} className="inline-flex items-center gap-2 font-body text-sm text-brand-text-secondary hover:text-brand-text transition-colors mb-6">
        <ArrowLeft size={16} /> Back to Categories
      </button>
      <h1 data-testid="category-form-title" className="font-heading text-3xl font-bold text-brand-text tracking-tight mb-8">
        {isEdit ? "Edit Category" : "Add New Category"}
      </h1>

      {error && <div data-testid="cat-form-error" className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-body rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Category Name</Label>
          <Input data-testid="cat-input-name" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Starters" className="bg-brand-bg border-brand-border font-body text-sm h-11" />
        </div>

        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Slug (URL-friendly name)</Label>
          <Input data-testid="cat-input-slug" value={form.slug} onChange={(e) => setForm(p => ({ ...p, slug: e.target.value }))} placeholder="Auto-generated from name" className="bg-brand-bg border-brand-border font-body text-sm h-11" />
          <p className="font-body text-[10px] text-brand-text-secondary mt-1">Used in URLs: /menu/starters</p>
        </div>

        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Description</Label>
          <Textarea data-testid="cat-input-description" value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe this category..." className="bg-brand-bg border-brand-border font-body text-sm resize-none min-h-[80px]" />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Parent Category</Label>
            <Select value={form.parent_id} onValueChange={(v) => setForm(p => ({ ...p, parent_id: v }))}>
              <SelectTrigger data-testid="cat-select-parent" className="bg-brand-bg border-brand-border font-body text-sm h-11">
                <SelectValue placeholder="None (top-level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (top-level)</SelectItem>
                {parentOptions.filter(p => p.id !== id).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Visibility</Label>
            <div className="flex items-center gap-3 h-11">
              <Switch data-testid="cat-toggle-visible" checked={form.visible} onCheckedChange={(v) => setForm(p => ({ ...p, visible: v }))} />
              <span className="font-body text-sm text-brand-text">{form.visible ? "Visible" : "Hidden"}</span>
            </div>
          </div>
        </div>

        {/* Image */}
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Category Image</Label>
          {form.image && (
            <div className="relative w-full h-40 rounded-xl overflow-hidden border border-brand-border mb-3 group">
              <img src={form.image} alt="Category" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setForm(p => ({ ...p, image: "" }))} className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Input data-testid="cat-input-image-url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Paste image URL..." className="bg-brand-bg border-brand-border font-body text-sm h-10 flex-1" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSetImage(); }}} />
            <button type="button" data-testid="cat-add-image-btn" onClick={handleSetImage} className="px-4 py-2 bg-brand-bg border border-brand-border text-brand-text font-body text-sm rounded-lg hover:bg-brand-surface transition-colors flex items-center gap-1">
              <ImagePlus size={14} /> Set
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" data-testid="save-category-btn" disabled={saving} className="px-8 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : isEdit ? "Update Category" : "Create Category"}
          </button>
          <button type="button" onClick={() => navigate("/admin/categories")} className="px-6 py-3 bg-brand-surface border border-brand-border text-brand-text font-body text-sm rounded-full hover:bg-brand-bg transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
