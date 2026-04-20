import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { Loader2, Search as SearchIcon } from "lucide-react";

const API = "/api";

export default function SearchResultsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const category = params.get("category") || "all";
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API}/categories`).then(({ data }) => {
      const tops = (data.categories || []).filter((c) => !c.parent_id);
      setCategories(tops);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!q) { setItems([]); return; }
    setLoading(true);
    axios.get(`${API}/search/menu`, { params: { q, category: category === "all" ? undefined : category, limit: 30 } })
      .then(({ data }) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [q, category]);

  const setCategory = (slug) => {
    const next = new URLSearchParams(params);
    if (slug === "all") next.delete("category"); else next.set("category", slug);
    setParams(next);
  };

  return (
    <div data-testid="search-results-page" className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <SearchIcon size={24} className="text-brand-primary" />
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">
          {q ? <>Results for <span className="italic">“{q}”</span></> : "Search"}
        </h1>
      </div>

      {/* Category pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {[{ slug: "all", name: "All" }, ...categories].map((c) => (
            <button
              key={c.slug}
              data-testid={`search-filter-${c.slug}`}
              onClick={() => setCategory(c.slug)}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${category === c.slug ? "bg-brand-primary text-white border-brand-primary" : "border-brand-border text-brand-text-secondary hover:border-brand-primary/40"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 size={28} className="animate-spin text-brand-primary" /></div>
      ) : !q ? (
        <div className="py-16 text-center text-sm text-brand-text-secondary">Start typing to search the menu.</div>
      ) : items.length === 0 ? (
        <div data-testid="search-no-results" className="bg-brand-surface border border-dashed border-brand-border rounded-xl p-10 text-center">
          <p className="font-body text-sm text-brand-text-secondary">No matches. Try a different query or clear the category filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((it) => (
            <Link
              key={it.id}
              to={`/menu/item/${it.id}`}
              data-testid={`search-hit-${it.id}`}
              className="group bg-white rounded-xl border border-brand-border overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition"
            >
              {it.image && <img src={it.image} alt="" className="w-full h-48 object-cover group-hover:scale-[1.02] transition" />}
              <div className="p-4">
                <div className="text-xs uppercase tracking-wider text-brand-primary font-semibold mb-1">{it.category}</div>
                <h3 className="font-heading text-lg font-bold text-brand-text">{it.name}</h3>
                <p className="font-body text-sm text-brand-text-secondary line-clamp-2 mt-1">{it.description}</p>
                <div className="mt-3 font-body text-base font-semibold text-brand-text">${it.price?.toFixed?.(2) ?? it.price}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
