import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, X, ImagePlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import axios from "axios";

// Use relative URL to avoid CORS redirect issues
const API_BASE = "/api";
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const CATEGORIES = ["starters", "mains", "drinks", "desserts"];
const STATUSES = [
  { value: "in_stock", label: "In Stock" },
  { value: "sold_out", label: "Sold Out" },
  { value: "seasonal", label: "Seasonal" },
];

export default function AdminItemForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "mains",
    status: "in_stock",
    tags: "",
    images: [],
  });
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingItem, setLoadingItem] = useState(isEdit);

  useEffect(() => {
    if (isEdit) {
      axios.get(`${API_BASE}/menu/items/${id}`, { withCredentials: true })
        .then(({ data }) => {
          setForm({
            name: data.name || "",
            description: data.description || "",
            price: String(data.price || ""),
            category: data.category || "mains",
            status: data.status || "in_stock",
            tags: (data.tags || []).join(", "),
            images: data.images || (data.image ? [data.image] : []),
          });
        })
        .catch(() => setError("Failed to load item"))
        .finally(() => setLoadingItem(false));
    }
  }, [id, isEdit]);

  const addImage = () => {
    if (imageUrl.trim() && !form.images.includes(imageUrl.trim())) {
      setForm((p) => ({ ...p, images: [...p.images, imageUrl.trim()] }));
      setImageUrl("");
    }
  };

  const removeImage = (idx) => {
    setForm((p) => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.price || isNaN(Number(form.price))) { setError("Valid price is required"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price),
      category: form.category,
      status: form.status,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      images: form.images,
      image: form.images[0] || "",
    };
    try {
      if (isEdit) {
        await axios.put(`${API_BASE}/admin/menu/items/${id}`, payload, { withCredentials: true });
      } else {
        await axios.post(`${API_BASE}/admin/menu/items`, payload, { withCredentials: true });
      }
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

      <h1 data-testid="item-form-title" className="font-heading text-3xl font-bold text-brand-text tracking-tight mb-8">
        {isEdit ? "Edit Item" : "Add New Item"}
      </h1>

      {error && <div data-testid="form-error" className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-body rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Item Name</Label>
          <Input data-testid="input-name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Heritage Duck Breast" className="bg-brand-bg border-brand-border font-body text-sm h-11" />
        </div>

        {/* Description */}
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Description</Label>
          <Textarea data-testid="input-description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Describe the dish, ingredients, and preparation..." className="bg-brand-bg border-brand-border font-body text-sm resize-none min-h-[100px]" />
        </div>

        {/* Price + Category */}
        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Price ($)</Label>
            <Input data-testid="input-price" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} placeholder="0.00" className="bg-brand-bg border-brand-border font-body text-sm h-11" />
          </div>
          <div>
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
              <SelectTrigger data-testid="select-category" className="bg-brand-bg border-brand-border font-body text-sm h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (<SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status + Tags */}
        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Availability Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
              <SelectTrigger data-testid="select-status" className="bg-brand-bg border-brand-border font-body text-sm h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Tags (comma separated)</Label>
            <Input data-testid="input-tags" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} placeholder="CHEF'S SIGNATURE, WOOD-FIRED" className="bg-brand-bg border-brand-border font-body text-sm h-11" />
          </div>
        </div>

        {/* Images */}
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Images</Label>
          {form.images.length > 0 && (
            <div className="flex gap-3 overflow-x-auto hide-scrollbar mb-3">
              {form.images.map((url, idx) => (
                <div key={idx} className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-brand-border group">
                  <img src={url} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(idx)} data-testid={`remove-image-${idx}`} className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={10} />
                  </button>
                  {idx === 0 && <span className="absolute bottom-1 left-1 px-1 py-0.5 bg-brand-primary text-white text-[8px] font-body font-bold rounded">Main</span>}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input data-testid="input-image-url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Paste image URL..." className="bg-brand-bg border-brand-border font-body text-sm h-10 flex-1" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImage(); } }} />
            <button type="button" data-testid="add-image-btn" onClick={addImage} className="px-4 py-2 bg-brand-bg border border-brand-border text-brand-text font-body text-sm rounded-lg hover:bg-brand-surface transition-colors flex items-center gap-1">
              <ImagePlus size={14} /> Add
            </button>
          </div>
          <p className="font-body text-[10px] text-brand-text-secondary mt-1">First image will be used as the main display image.</p>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-4">
          <button type="submit" data-testid="save-item-btn" disabled={saving} className="px-8 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : isEdit ? "Update Item" : "Create Item"}
          </button>
          <button type="button" onClick={() => navigate("/admin/catalog")} className="px-6 py-3 bg-brand-surface border border-brand-border text-brand-text font-body text-sm rounded-full hover:bg-brand-bg transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
