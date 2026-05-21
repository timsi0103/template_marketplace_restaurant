import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, X, ImagePlus, GripVertical, Star, Loader2, Upload, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";

const API_BASE = "/api";
const STATUSES = [
  { value: "in_stock", label: "In stock" },
  { value: "sold_out", label: "Sold out" },
  { value: "seasonal", label: "Seasonal" },
];

// Friendly labels for dietary slugs (keeps the data side as machine-readable slugs)
const DIETARY_LABEL = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
  halal: "Halal",
  kosher: "Kosher",
  nut_free: "Nut-free",
  spicy: "Spicy",
  low_carb: "Low-carb",
};
const labelFor = (slug) => DIETARY_LABEL[slug] || slug.replace(/_/g, " ");

export default function AdminItemForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name: "", description: "", price: "",
    category: "", subcategory: "", status: "in_stock",
    tags: "", dietary_tags: [],
    images: [],
  });
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loadingItem, setLoadingItem] = useState(isEdit);

  const [categories, setCategories] = useState([]);
  const [allDietary, setAllDietary] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // Load categories tree
  useEffect(() => {
    axios.get(`${API_BASE}/categories/tree`)
      .then(({ data }) => setCategories(data.categories || []))
      .catch(() => setCategories([]));
  }, []);

  // Auto-select first category once it's loaded and we're creating a new item
  useEffect(() => {
    if (isEdit) return;
    if (categories.length === 0) return;
    setForm((p) => (p.category ? p : { ...p, category: categories[0].slug }));
  }, [categories, isEdit]);

  // Load dietary catalog (controlled vocabulary)
  useEffect(() => {
    axios.get(`${API_BASE}/catalog/settings`)
      .then(({ data }) => setAllDietary(data.all_dietary_tags || data.visible_dietary_tags || []))
      .catch(() => setAllDietary([]));
  }, []);

  // Subcategories follow category selection
  const subcategoryOptions = (categories.find((c) => c.slug === form.category)?.subcategories) || [];

  // Load existing item if editing
  useEffect(() => {
    if (!isEdit) return;
    axios.get(`${API_BASE}/menu/items/${id}`, { withCredentials: true })
      .then(({ data }) => setForm({
        name: data.name || "",
        description: data.description || "",
        price: String(data.price || ""),
        category: data.category || "",
        subcategory: data.subcategory || "",
        status: data.status || "in_stock",
        tags: (data.tags || []).join(", "),
        dietary_tags: data.dietary_tags || [],
        images: data.images || (data.image ? [data.image] : []),
      }))
      .catch(() => setError("Failed to load item"))
      .finally(() => setLoadingItem(false));
  }, [id, isEdit]);

  // ── Image management ──────────────────────────────────
  const addImageUrl = () => {
    const url = imageUrl.trim();
    if (!url) return;
    if (form.images.includes(url)) {
      toast.error("That image is already added");
      return;
    }
    setForm((p) => ({ ...p, images: [...p.images, url] }));
    setImageUrl("");
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("purpose", "menu_item");
        const { data } = await axios.post(`${API_BASE}/admin/uploads`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          withCredentials: true,
        });
        if (data?.url) uploaded.push(data.url);
      }
      if (uploaded.length) {
        setForm((p) => ({ ...p, images: [...p.images, ...uploaded] }));
        toast.success(`${uploaded.length} ${uploaded.length === 1 ? "image" : "images"} uploaded`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (idx) => setForm((p) => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));
  const setPrimary = (idx) => {
    if (idx === 0) return;
    setForm((p) => {
      const imgs = [...p.images];
      const [moved] = imgs.splice(idx, 1);
      imgs.unshift(moved);
      return { ...p, images: imgs };
    });
  };
  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (targetIdx) => {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    setForm((p) => {
      const imgs = [...p.images];
      const [moved] = imgs.splice(dragIdx, 1);
      imgs.splice(targetIdx, 0, moved);
      return { ...p, images: imgs };
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // ── Dietary tag chips ─────────────────────────────────
  const toggleDietary = (slug) => {
    setForm((p) => {
      const has = p.dietary_tags.includes(slug);
      return { ...p, dietary_tags: has ? p.dietary_tags.filter((t) => t !== slug) : [...p.dietary_tags, slug] };
    });
  };

  // ── Submit ────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.price || isNaN(Number(form.price))) { setError("Valid price is required"); return; }
    if (!form.category) { setError("Pick a category"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price),
      category: form.category,
      subcategory: form.subcategory || null,
      status: form.status,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      dietary_tags: form.dietary_tags,
      images: form.images,
      image: form.images[0] || "",
    };
    try {
      if (isEdit) await axios.put(`${API_BASE}/admin/menu/items/${id}`, payload, { withCredentials: true });
      else await axios.post(`${API_BASE}/admin/menu/items`, payload, { withCredentials: true });
      toast.success(isEdit ? "Item updated" : "Item created");
      navigate("/admin/catalog");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  if (loadingItem) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <button data-testid="back-to-catalog-btn" onClick={() => navigate("/admin/catalog")} className="inline-flex items-center gap-2 font-body text-sm text-brand-text-secondary hover:text-brand-text transition-colors mb-6">
        <ArrowLeft size={16} /> Back to Catalog
      </button>
      <h1 data-testid="item-form-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text tracking-tight">
        {isEdit ? "Edit menu item" : "New menu item"}
      </h1>
      <p className="font-body text-sm text-brand-text-secondary mt-1.5 mb-8">All fields below render straight on the customer-facing menu. Dietary tags come from your filter settings.</p>

      {error && <div data-testid="form-error" className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-body rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basics */}
        <section className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6 space-y-5">
          <h2 className="font-heading text-base font-bold text-brand-text">Basics</h2>
          <div>
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Item name</Label>
            <Input data-testid="input-name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Heritage Duck Breast" className="bg-brand-bg border-brand-border font-body text-sm h-11" />
          </div>
          <div>
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Description</Label>
            <Textarea data-testid="input-description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Describe the dish, ingredients, and preparation…" className="bg-brand-bg border-brand-border font-body text-sm resize-none min-h-[100px]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Price ($)</Label>
              <Input data-testid="input-price" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} placeholder="0.00" className="bg-brand-bg border-brand-border font-body text-sm h-11" />
            </div>
            <div>
              <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Availability</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger data-testid="select-status" className="bg-brand-bg border-brand-border font-body text-sm h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Categorization */}
        <section className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6 space-y-5">
          <h2 className="font-heading text-base font-bold text-brand-text">Categorization</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Category</Label>
              <Select value={form.category || undefined} onValueChange={(v) => setForm((p) => ({ ...p, category: v, subcategory: "" }))}>
                <SelectTrigger data-testid="select-category" className="bg-brand-bg border-brand-border font-body text-sm h-11"><SelectValue placeholder={categories.length ? "Select a category" : "Loading…"} /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.slug} value={c.slug} className="capitalize">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-brand-text-secondary mt-1.5">Manage categories under <span className="underline">Categories</span>.</p>
            </div>
            <div>
              <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Subcategory <span className="lowercase normal-case text-brand-text-secondary">(optional)</span></Label>
              <Select
                value={form.subcategory || "none"}
                onValueChange={(v) => setForm((p) => ({ ...p, subcategory: v === "none" ? "" : v }))}
                disabled={subcategoryOptions.length === 0}
              >
                <SelectTrigger data-testid="select-subcategory" className="bg-brand-bg border-brand-border font-body text-sm h-11">
                  <SelectValue placeholder={subcategoryOptions.length === 0 ? "No subcategories" : "Select"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {subcategoryOptions.map((s) => (
                    <SelectItem key={s.slug} value={s.slug} className="capitalize">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Dietary tags (controlled vocabulary, customer-facing) */}
        <section className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <h2 className="font-heading text-base font-bold text-brand-text">Dietary tags</h2>
            <span className="text-[11px] text-brand-text-secondary">{form.dietary_tags.length} selected</span>
          </div>
          <p className="font-body text-xs text-brand-text-secondary mb-3">These appear as filter chips on the menu. Manage the master list under <span className="underline">Menu &amp; Search</span>.</p>
          {allDietary.length === 0 ? (
            <p className="text-sm italic text-brand-text-secondary">No dietary tags configured yet.</p>
          ) : (
            <div data-testid="dietary-chip-row" className="flex flex-wrap gap-2">
              {allDietary.map((slug) => {
                const on = form.dietary_tags.includes(slug);
                return (
                  <button
                    key={slug}
                    type="button"
                    data-testid={`dietary-${slug}`}
                    onClick={() => toggleDietary(slug)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-body font-semibold border transition-all ${on ? "bg-brand-primary text-white border-brand-primary" : "bg-brand-bg text-brand-text border-brand-border hover:border-brand-primary/50"}`}
                  >
                    {labelFor(slug)}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Marketing tags */}
        <section className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6">
          <h2 className="font-heading text-base font-bold text-brand-text">Marketing tags</h2>
          <p className="font-body text-xs text-brand-text-secondary mb-3">Free-text labels shown above the price (e.g. <em>"Chef's signature"</em>, <em>"Wood-fired"</em>). Comma-separated.</p>
          <Input data-testid="input-tags" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} placeholder="CHEF'S SIGNATURE, WOOD-FIRED" className="bg-brand-bg border-brand-border font-body text-sm h-11" />
        </section>

        {/* Images */}
        <section className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <h2 className="font-heading text-base font-bold text-brand-text">Images</h2>
            <span className="text-[11px] text-brand-text-secondary">{form.images.length} {form.images.length === 1 ? "photo" : "photos"}</span>
          </div>
          <p className="font-body text-xs text-brand-text-secondary mb-3">Drag thumbnails to reorder. The first image becomes the primary card photo. Tap the star to promote any image to primary.</p>

          {form.images.length > 0 && (
            <div data-testid="image-gallery-admin" className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
              {form.images.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  data-testid={`admin-image-${idx}`}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 group cursor-grab active:cursor-grabbing transition-all ${
                    dragOverIdx === idx ? "border-brand-orange scale-105" : idx === 0 ? "border-brand-primary" : "border-brand-border"
                  }`}
                >
                  <img src={url} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1 w-6 h-6 bg-black/40 backdrop-blur-sm rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical size={12} className="text-white" />
                  </div>
                  <button type="button" onClick={() => setPrimary(idx)} data-testid={`set-primary-${idx}`}
                    className={`absolute top-1 right-7 w-6 h-6 rounded flex items-center justify-center transition-all ${idx === 0 ? "bg-brand-primary text-white" : "bg-black/40 backdrop-blur-sm text-white/70 opacity-0 group-hover:opacity-100 hover:text-white"}`}>
                    <Star size={10} className={idx === 0 ? "fill-white" : ""} />
                  </button>
                  <button type="button" onClick={() => removeImage(idx)} data-testid={`remove-image-${idx}`}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/40 backdrop-blur-sm text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500">
                    <X size={10} />
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-brand-primary text-white text-[8px] font-body font-bold rounded">Primary</span>
                  )}
                  <span className="absolute bottom-1 right-1 w-5 h-5 bg-black/40 backdrop-blur-sm rounded flex items-center justify-center font-body text-[9px] text-white font-bold">{idx + 1}</span>
                </div>
              ))}
            </div>
          )}

          {/* Upload row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              data-testid="upload-image-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-primary text-white font-body text-sm font-semibold hover:bg-brand-primary-hover disabled:opacity-60 transition-colors"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? "Uploading…" : "Upload from device"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              data-testid="upload-input"
              onChange={handleFileUpload}
            />

            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
                <Input
                  data-testid="input-image-url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="…or paste an image URL"
                  className="pl-9 bg-brand-bg border-brand-border font-body text-sm h-10"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImageUrl(); } }}
                />
              </div>
              <button type="button" data-testid="add-image-btn" onClick={addImageUrl} className="px-3.5 py-2 bg-brand-bg border border-brand-border text-brand-text font-body text-sm rounded-lg hover:bg-brand-surface transition-colors flex items-center gap-1 h-10 whitespace-nowrap">
                <ImagePlus size={14} /> Add
              </button>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
          <button type="button" onClick={() => navigate("/admin/catalog")} className="px-6 py-3 bg-brand-surface border border-brand-border text-brand-text font-body text-sm rounded-full hover:bg-brand-bg transition-colors">Cancel</button>
          <button
            type="submit"
            data-testid="save-item-btn"
            disabled={saving}
            className="flex-1 sm:flex-initial px-8 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Saving…" : isEdit ? "Update item" : "Create item"}
          </button>
        </div>
      </form>
    </div>
  );
}
