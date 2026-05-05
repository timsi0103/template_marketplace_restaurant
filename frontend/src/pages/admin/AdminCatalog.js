import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Plus, Pencil, Trash2, Search, Archive, ArchiveRestore, MoreHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import axios from "axios";

const API_BASE = "/api";

export default function AdminCatalog() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [archiveView, setArchiveView] = useState(false); // false = active items, true = archived items
  const [pendingDelete, setPendingDelete] = useState(null);   // item awaiting hard-delete confirmation
  const [pendingArchive, setPendingArchive] = useState(null); // item awaiting archive confirmation

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/menu/items`, {
        params: { include_archived: true },
        withCredentials: true,
      });
      setItems(data.items || []);
    } catch {
      toast.error("Failed to load catalog");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    axios.get(`${API_BASE}/categories/tree`)
      .then(({ data }) => setCategories(data.categories || []))
      .catch(() => setCategories([]));
  }, []);

  const handleToggle = async (item) => {
    try {
      const { data } = await axios.patch(`${API_BASE}/admin/menu/items/${item.id}/toggle`, {}, { withCredentials: true });
      setItems((prev) => prev.map((i) => (i.id === item.id ? data : i)));
      toast.success(`Marked "${item.name}" ${data.status === "in_stock" ? "in stock" : "sold out"}`);
    } catch {
      toast.error("Failed to update availability");
    }
  };

  const handleArchive = async () => {
    if (!pendingArchive) return;
    const item = pendingArchive;
    setPendingArchive(null);
    try {
      await axios.patch(`${API_BASE}/admin/menu/items/${item.id}/archive`, {}, { withCredentials: true });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_archived: true, available: false } : i)));
      toast.success(`Archived "${item.name}". You can restore it from the Archived view.`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Archive failed");
    }
  };

  const handleUnarchive = async (item) => {
    try {
      await axios.patch(`${API_BASE}/admin/menu/items/${item.id}/unarchive`, {}, { withCredentials: true });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_archived: false } : i)));
      toast.success(`Restored "${item.name}"`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Restore failed");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const item = pendingDelete;
    setPendingDelete(null);
    try {
      await axios.delete(`${API_BASE}/admin/menu/items/${item.id}`, { withCredentials: true });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success(`Deleted "${item.name}" permanently`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Delete failed");
    }
  };

  const filterChips = useMemo(
    () => [{ slug: "all", name: "All items" }, ...categories.map((c) => ({ slug: c.slug, name: c.name }))],
    [categories]
  );

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (archiveView !== Boolean(item.is_archived)) return false;
      const matchesCat = catFilter === "all" || item.category === catFilter;
      const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [items, archiveView, catFilter, search]);

  const activeCount = items.filter((i) => !i.is_archived).length;
  const archivedCount = items.filter((i) => i.is_archived).length;

  const statusBadge = (item) => {
    if (item.is_archived) return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-body font-semibold uppercase rounded">Archived</span>;
    if (item.status === "sold_out") return <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-body font-semibold uppercase rounded">Sold Out</span>;
    if (item.status === "seasonal") return <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-body font-semibold uppercase rounded">Seasonal</span>;
    return <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-body font-semibold uppercase rounded">In Stock</span>;
  };

  return (
    <div className="p-6 lg:p-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 data-testid="catalog-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text tracking-tight">Catalog management</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">{activeCount} active · {archivedCount} archived</p>
        </div>
        <Link to="/admin/catalog/new" data-testid="catalog-add-btn" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover transition-colors">
          <Plus size={16} /> Add new item
        </Link>
      </div>

      {/* Active / Archived tabs */}
      <div className="flex items-center gap-2 mb-5">
        <button
          data-testid="catalog-tab-active"
          onClick={() => setArchiveView(false)}
          className={`px-4 py-2 rounded-full text-xs font-body font-semibold border transition-colors ${!archiveView ? "bg-brand-primary text-white border-brand-primary" : "bg-brand-surface text-brand-text border-brand-border hover:border-brand-primary/50"}`}
        >
          Active <span className="ml-1 text-[10px] opacity-80">{activeCount}</span>
        </button>
        <button
          data-testid="catalog-tab-archived"
          onClick={() => setArchiveView(true)}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-body font-semibold border transition-colors ${archiveView ? "bg-brand-primary text-white border-brand-primary" : "bg-brand-surface text-brand-text border-brand-border hover:border-brand-primary/50"}`}
        >
          <Archive size={12} /> Archived <span className="text-[10px] opacity-80">{archivedCount}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
          <Input
            data-testid="catalog-search"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-brand-bg border-brand-border font-body text-sm h-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {filterChips.map((cat) => (
            <button
              key={cat.slug}
              data-testid={`catalog-filter-${cat.slug}`}
              onClick={() => setCatFilter(cat.slug)}
              className={`px-4 py-2 rounded-lg font-body text-xs font-medium border whitespace-nowrap capitalize transition-all ${catFilter === cat.slug ? "bg-brand-primary text-white border-brand-primary" : "bg-brand-surface text-brand-text-secondary border-brand-border hover:border-brand-text"}`}
            >
              {cat.name}
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
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-brand-border bg-brand-bg/50">
                  <th className="text-left px-4 py-3 font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Item</th>
                  <th className="text-left px-4 py-3 font-body text-[10px] uppercase tracking-widest text-brand-text-secondary hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Price</th>
                  <th className="text-left px-4 py-3 font-body text-[10px] uppercase tracking-widest text-brand-text-secondary hidden md:table-cell">Status</th>
                  {!archiveView && (
                    <th className="text-center px-4 py-3 font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Available</th>
                  )}
                  <th className="text-right px-4 py-3 font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id} data-testid={`catalog-row-${item.id}`} className={`border-b border-brand-border last:border-0 hover:bg-brand-bg/30 transition-colors ${item.is_archived ? "opacity-70" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={item.image} alt={item.name} className={`w-10 h-10 rounded-lg object-cover flex-shrink-0 ${item.status === "sold_out" || item.is_archived ? "opacity-40 grayscale" : ""}`} />
                        <div className="min-w-0">
                          <p className={`font-heading text-sm font-bold truncate ${item.is_archived ? "text-brand-text-secondary line-through" : "text-brand-text"}`}>{item.name}</p>
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
                    <td className="px-4 py-3 hidden md:table-cell">{statusBadge(item)}</td>
                    {!archiveView && (
                      <td className="px-4 py-3 text-center">
                        <Switch
                          data-testid={`toggle-${item.id}`}
                          checked={item.status === "in_stock"}
                          onCheckedChange={() => handleToggle(item)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {item.is_archived ? (
                          <>
                            <button
                              data-testid={`restore-${item.id}`}
                              onClick={() => handleUnarchive(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200 hover:bg-emerald-100"
                            >
                              <ArchiveRestore size={12} /> Restore
                            </button>
                            <button
                              data-testid={`delete-${item.id}`}
                              onClick={() => setPendingDelete(item)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-text-secondary hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete permanently"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <Link to={`/admin/catalog/${item.id}/edit`} data-testid={`edit-${item.id}`} className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-text-secondary hover:text-brand-primary hover:bg-brand-bg transition-colors" title="Edit">
                              <Pencil size={14} />
                            </Link>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button data-testid={`actions-${item.id}`} className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-text-secondary hover:text-brand-primary hover:bg-brand-bg transition-colors">
                                  <MoreHorizontal size={14} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  data-testid={`archive-${item.id}`}
                                  onClick={() => setPendingArchive(item)}
                                  className="cursor-pointer"
                                >
                                  <Archive size={14} className="mr-2" /> Archive item
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  data-testid={`delete-${item.id}`}
                                  onClick={() => setPendingDelete(item)}
                                  className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                                >
                                  <Trash2 size={14} className="mr-2" /> Delete permanently
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={archiveView ? 5 : 6} className="px-4 py-12 text-center font-body text-sm text-brand-text-secondary">
                      {archiveView ? "Nothing archived yet." : "No items match this filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Archive confirm */}
      <AlertDialog open={!!pendingArchive} onOpenChange={(o) => !o && setPendingArchive(null)}>
        <AlertDialogContent data-testid="archive-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive "{pendingArchive?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The item will be hidden from the customer menu but kept on past orders and reports. You can restore it any time from the <strong>Archived</strong> tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="archive-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="archive-confirm-btn" onClick={handleArchive}>
              Archive item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent data-testid="delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}" permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The item is removed from the catalog. Past orders that referenced it stay intact, but you won&apos;t be able to recover it. Consider <strong>archiving</strong> instead if you might use it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="delete-confirm-btn"
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
