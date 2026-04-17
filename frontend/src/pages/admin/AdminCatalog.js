import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import axios from "axios";

// Use relative URL to avoid CORS redirect issues
const API_BASE = "/api";
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const CATEGORIES = ["all", "starters", "mains", "drinks", "desserts"];

export default function AdminCatalog() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [deleting, setDeleting] = useState(null);

  const fetchItems = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/menu/items`, { withCredentials: true });
      setItems(data.items || []);
    } catch (e) {
      console.error("Failed to fetch items", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleToggle = async (itemId) => {
    try {
      const { data } = await axios.patch(`${API_BASE}/admin/menu/items/${itemId}/toggle`, {}, { withCredentials: true });
      setItems((prev) => prev.map((i) => (i.id === itemId ? data : i)));
    } catch (e) {
      console.error("Toggle failed", e);
    }
  };

  const handleDelete = async (itemId) => {
    if (deleting === itemId) {
      try {
        await axios.delete(`${API_BASE}/admin/menu/items/${itemId}`, { withCredentials: true });
        setItems((prev) => prev.filter((i) => i.id !== itemId));
      } catch (e) {
        console.error("Delete failed", e);
      }
      setDeleting(null);
    } else {
      setDeleting(itemId);
      setTimeout(() => setDeleting(null), 3000);
    }
  };

  const filtered = items.filter((item) => {
    const matchesCat = catFilter === "all" || item.category === catFilter;
    const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const statusBadge = (status) => {
    if (status === "sold_out") return <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-body font-semibold uppercase rounded">Sold Out</span>;
    if (status === "seasonal") return <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-body font-semibold uppercase rounded">Seasonal</span>;
    return <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-body font-semibold uppercase rounded">In Stock</span>;
  };

  return (
    <div className="p-6 lg:p-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 data-testid="catalog-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text tracking-tight">Catalog Management</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">{items.length} items in your menu</p>
        </div>
        <Link to="/admin/catalog/new" data-testid="catalog-add-btn" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white font-body text-sm font-medium rounded-lg hover:bg-brand-primary-hover transition-colors">
          <Plus size={16} /> Add New Item
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
          <Input
            data-testid="catalog-search"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-brand-bg border-brand-border font-body text-sm h-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              data-testid={`catalog-filter-${cat}`}
              onClick={() => setCatFilter(cat)}
              className={`px-4 py-2 rounded-lg font-body text-xs font-medium border whitespace-nowrap capitalize transition-all ${catFilter === cat ? "bg-brand-primary text-white border-brand-primary" : "bg-brand-surface text-brand-text-secondary border-brand-border hover:border-brand-text"}`}
            >
              {cat === "all" ? "All Items" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div data-testid="catalog-table" className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-border bg-brand-bg/50">
                  <th className="text-left px-4 py-3 font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Item</th>
                  <th className="text-left px-4 py-3 font-body text-[10px] uppercase tracking-widest text-brand-text-secondary hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Price</th>
                  <th className="text-left px-4 py-3 font-body text-[10px] uppercase tracking-widest text-brand-text-secondary hidden md:table-cell">Status</th>
                  <th className="text-center px-4 py-3 font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Available</th>
                  <th className="text-right px-4 py-3 font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} data-testid={`catalog-row-${item.id}`} className="border-b border-brand-border last:border-0 hover:bg-brand-bg/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={item.image} alt={item.name} className={`w-10 h-10 rounded-lg object-cover flex-shrink-0 ${item.status === "sold_out" ? "opacity-40 grayscale" : ""}`} />
                        <div className="min-w-0">
                          <p className={`font-heading text-sm font-bold truncate ${item.status === "sold_out" ? "text-brand-text-secondary" : "text-brand-text"}`}>{item.name}</p>
                          <p className="font-body text-[10px] text-brand-text-secondary truncate max-w-[200px]">{item.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="px-2.5 py-1 bg-brand-bg text-brand-text-secondary text-[10px] font-body font-medium uppercase tracking-wider rounded capitalize">{item.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-heading text-sm font-bold text-brand-primary">${item.price?.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">{statusBadge(item.status)}</td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        data-testid={`toggle-${item.id}`}
                        checked={item.status === "in_stock"}
                        onCheckedChange={() => handleToggle(item.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/admin/catalog/${item.id}/edit`} data-testid={`edit-${item.id}`} className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-text-secondary hover:text-brand-primary hover:bg-brand-bg transition-colors">
                          <Pencil size={14} />
                        </Link>
                        <button
                          data-testid={`delete-${item.id}`}
                          onClick={() => handleDelete(item.id)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${deleting === item.id ? "bg-red-500 text-white" : "text-brand-text-secondary hover:text-red-500 hover:bg-red-50"}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center font-body text-sm text-brand-text-secondary">No items found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
