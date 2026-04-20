import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus, Search as SearchIcon, X, SlidersHorizontal, Eye, LayoutGrid, List, ArrowUpDown, Star } from "lucide-react";
import axios from "axios";
import { useCart } from "@/contexts/CartContext";
import FilterDrawer from "@/components/menu/FilterDrawer";
import QuickViewModal from "@/components/menu/QuickViewModal";
import { useSeo } from "@/hooks/useSeo";

const API = "/api";

const SORT_OPTIONS = [
  { value: "popularity", label: "Popular" },
  { value: "price_asc", label: "Price: low → high" },
  { value: "price_desc", label: "Price: high → low" },
  { value: "newest", label: "Newest" },
  { value: "name_asc", label: "A → Z" },
];

const SEARCH_SUGGESTIONS = ["Burrata", "Duck", "Tagliatelle", "Pizza", "Cold Brew", "Vegan"];

function SkeletonCard() {
  return (
    <div data-testid="skeleton-card" className="rounded-2xl overflow-hidden bg-brand-surface border border-brand-border">
      <div className="aspect-[4/3] bg-brand-border/40 skeleton-shimmer" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-3/4 bg-brand-border/40 rounded skeleton-shimmer" />
        <div className="h-3 w-full bg-brand-border/30 rounded skeleton-shimmer" />
        <div className="flex items-center justify-between mt-2">
          <div className="h-5 w-16 bg-brand-border/40 rounded skeleton-shimmer" />
          <div className="w-8 h-8 bg-brand-border/30 rounded-full skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

export default function MenuPage() {
  const { addItem } = useCart();
  useSeo("menu");

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogSettings, setCatalogSettings] = useState(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [autocomplete, setAutocomplete] = useState([]);
  const [autoOpen, setAutoOpen] = useState(false);
  const autoRef = useRef(null);

  const [activeDietary, setActiveDietary] = useState(new Set());
  const [priceRange, setPriceRange] = useState([0, 100]);
  const [priceBounds, setPriceBounds] = useState({ min: 0, max: 100 });
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState("popularity");
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState("list");

  const [quickViewId, setQuickViewId] = useState(null);
  const sectionRefs = useRef({});

  // Load settings (dietary visibility, default sort, price bounds, quick-view toggle)
  useEffect(() => {
    axios.get(`${API}/catalog/settings`).then(({ data }) => {
      setCatalogSettings(data);
      setSort(data.default_sort || "popularity");
      setPriceBounds({ min: Number(data.price_min ?? 0), max: Number(data.price_max ?? 100) });
      setPriceRange([Number(data.price_min ?? 0), Number(data.price_max ?? 100)]);
    }).catch(() => setCatalogSettings({
      visible_dietary_tags: [], default_sort: "popularity",
      quick_view_enabled: true, price_min: 0, price_max: 100,
      sticky_category_bar: true, show_in_stock_toggle: true,
    }));
  }, []);

  // Load categories
  useEffect(() => {
    axios.get(`${API}/categories/tree`).then(({ data }) => setCategories(data.categories || [])).catch(() => {});
  }, []);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 220);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch full result list (respects filters/sort/search)
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    for (const d of activeDietary) params.append("dietary", d);
    if (priceRange[0] > priceBounds.min) params.set("min_price", String(priceRange[0]));
    if (priceRange[1] < priceBounds.max) params.set("max_price", String(priceRange[1]));
    if (inStockOnly) params.set("in_stock_only", "true");
    params.set("sort", sort);
    params.set("limit", "60");
    axios.get(`${API}/search/menu?${params.toString()}`)
      .then(({ data }) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [debouncedSearch, activeDietary, priceRange, priceBounds.min, priceBounds.max, inStockOnly, sort]);

  // Autocomplete: lightweight, top 5 by name
  useEffect(() => {
    if (!search.trim()) { setAutocomplete([]); return; }
    const t = setTimeout(() => {
      axios.get(`${API}/search/menu`, { params: { q: search.trim(), limit: 6 } })
        .then(({ data }) => setAutocomplete(data.items || []))
        .catch(() => setAutocomplete([]));
    }, 180);
    return () => clearTimeout(t);
  }, [search]);

  // Click outside autocomplete
  useEffect(() => {
    const h = (e) => { if (autoRef.current && !autoRef.current.contains(e.target)) setAutoOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Group results by category for section rendering
  const grouped = useMemo(() => {
    const byCat = new Map();
    for (const it of items) {
      const key = it.category || "other";
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push(it);
    }
    return byCat;
  }, [items]);

  const visibleCategories = useMemo(() => {
    const slugs = new Set(grouped.keys());
    return categories.filter((c) => c.visible !== false && slugs.has(c.slug));
  }, [categories, grouped]);

  const dietaryOptions = catalogSettings?.visible_dietary_tags || [];
  const showInStockToggle = catalogSettings?.show_in_stock_toggle !== false;
  const stickyBar = catalogSettings?.sticky_category_bar !== false;
  const quickViewEnabled = catalogSettings?.quick_view_enabled !== false;

  const activeCount =
    activeDietary.size +
    (priceRange[0] > priceBounds.min || priceRange[1] < priceBounds.max ? 1 : 0) +
    (inStockOnly ? 1 : 0);

  const toggleDietary = (k) => setActiveDietary((prev) => {
    const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s;
  });
  const resetFilters = () => {
    setActiveDietary(new Set());
    setPriceRange([priceBounds.min, priceBounds.max]);
    setInStockOnly(false);
  };

  const scrollToCategory = useCallback((slug) => {
    const el = sectionRefs.current[slug];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 160;
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  const handleAdd = (e, item) => {
    e.preventDefault(); e.stopPropagation();
    if (item.status === "sold_out") return;
    addItem({ id: item.id, name: item.name, price: item.price, image: item.image });
  };

  const handleCardClick = (e, item) => {
    if (!quickViewEnabled) return;
    e.preventDefault();
    setQuickViewId(item.id);
  };

  return (
    <div data-testid="menu-page" className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
        <div className="flex items-end justify-between mb-5 sm:mb-8">
          <div>
            <h1 data-testid="menu-title" className="font-heading text-3xl sm:text-5xl lg:text-6xl font-bold text-brand-text tracking-tight leading-none">The Collection</h1>
            <p data-testid="menu-subtitle" className="font-body text-xs sm:text-base text-brand-text-secondary mt-2 sm:mt-3 max-w-xl leading-relaxed">
              A curated selection, searchable and filterable to your taste.
            </p>
          </div>
          <div data-testid="view-toggle" className="hidden sm:flex items-center gap-1 bg-brand-surface border border-brand-border rounded-lg p-1">
            <button data-testid="view-list-btn" onClick={() => setViewMode("list")} className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-brand-primary text-white" : "text-brand-text-secondary"}`}>
              <List size={16} />
            </button>
            <button data-testid="view-grid-btn" onClick={() => setViewMode("grid")} className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${viewMode === "grid" ? "bg-brand-primary text-white" : "text-brand-text-secondary"}`}>
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Sticky tool bar */}
      <div
        data-testid="menu-toolbar"
        className={`${stickyBar ? "sticky top-0 z-30" : ""} bg-brand-bg/95 backdrop-blur-md border-y border-brand-border/70`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 sm:gap-3">
          {/* Search */}
          <div ref={autoRef} className="relative flex-1 max-w-xl">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary pointer-events-none" />
            <input
              data-testid="menu-search-input"
              value={search}
              onFocus={() => setAutoOpen(true)}
              onChange={(e) => { setSearch(e.target.value); setAutoOpen(true); }}
              placeholder="Search dishes, tags, diets…"
              className="w-full h-10 pl-9 pr-9 rounded-full border border-brand-border bg-brand-surface focus:bg-white focus:border-brand-primary/60 text-sm outline-none transition"
            />
            {search && (
              <button data-testid="menu-search-clear" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-secondary hover:text-brand-primary">
                <X size={14} />
              </button>
            )}
            {autoOpen && search.trim() && autocomplete.length > 0 && (
              <div data-testid="autocomplete-dropdown" className="absolute top-full left-0 right-0 mt-1 bg-white border border-brand-border rounded-xl shadow-lg overflow-hidden z-50">
                {autocomplete.map((it) => (
                  <button
                    key={it.id}
                    data-testid={`autocomplete-${it.id}`}
                    onClick={() => {
                      setAutoOpen(false);
                      if (quickViewEnabled) setQuickViewId(it.id);
                      else window.location.href = `/product/${it.id}`;
                    }}
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-brand-surface transition text-left"
                  >
                    <img src={it.image} alt="" className="w-10 h-10 object-cover rounded-md" />
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-sm font-semibold text-brand-text truncate">{it.name}</div>
                      <div className="text-xs text-brand-text-secondary capitalize">{it.category} · ${it.price?.toFixed?.(2)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort */}
          <label className="relative inline-flex items-center">
            <span className="sr-only">Sort</span>
            <ArrowUpDown size={13} className="absolute left-3 text-brand-text-secondary pointer-events-none" />
            <select
              data-testid="menu-sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-10 pl-8 pr-3 rounded-full border border-brand-border bg-brand-surface text-xs font-body font-medium text-brand-text outline-none focus:border-brand-primary/60 appearance-none"
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          {/* Filter button */}
          <button
            data-testid="open-filters-btn"
            onClick={() => setFilterOpen(true)}
            className="relative h-10 px-4 inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-surface text-xs font-body font-semibold text-brand-text hover:border-brand-primary/40 transition"
          >
            <SlidersHorizontal size={13} /> <span className="hidden sm:inline">Filters</span>
            {activeCount > 0 && (
              <span data-testid="active-filter-count" className="ml-0.5 min-w-[18px] h-[18px] rounded-full bg-brand-primary text-white text-[10px] font-bold flex items-center justify-center px-1">{activeCount}</span>
            )}
          </button>
        </div>

        {/* Category pills row */}
        {visibleCategories.length > 0 && (
          <div data-testid="sticky-category-bar" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              {visibleCategories.map((c) => (
                <button
                  key={c.id}
                  data-testid={`category-pill-${c.slug}`}
                  onClick={() => scrollToCategory(c.slug)}
                  className="px-3.5 py-1.5 rounded-full border border-brand-border bg-brand-surface whitespace-nowrap text-xs font-body font-medium text-brand-text hover:bg-brand-primary hover:text-white hover:border-brand-primary transition active:scale-95"
                >
                  {c.name}
                  <span className="ml-1.5 text-[10px] opacity-60">{grouped.get(c.slug)?.length || 0}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Active filters chips */}
      {activeCount > 0 && (
        <div data-testid="active-chips-row" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 flex flex-wrap items-center gap-2">
          {[...activeDietary].map((k) => (
            <button key={k} onClick={() => toggleDietary(k)} className="px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-[11px] font-body font-medium flex items-center gap-1 hover:bg-brand-primary/20">
              {k.replace(/_/g, " ")} <X size={10} />
            </button>
          ))}
          {(priceRange[0] > priceBounds.min || priceRange[1] < priceBounds.max) && (
            <span className="px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-[11px] font-body font-medium">
              ${priceRange[0]}–${priceRange[1]}
            </span>
          )}
          {inStockOnly && (
            <span className="px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-[11px] font-body font-medium">In stock</span>
          )}
          <button onClick={resetFilters} data-testid="chips-clear-all" className="text-[11px] font-body font-semibold text-brand-text-secondary hover:text-brand-primary underline underline-offset-2">
            Clear all
          </button>
        </div>
      )}

      {/* Sections */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {loading ? (
          <div data-testid="skeleton-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div data-testid="no-results-state" className="text-center py-16 max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-primary/10 flex items-center justify-center mb-4">
              <SearchIcon size={24} className="text-brand-primary" />
            </div>
            <h3 className="font-heading text-2xl font-bold text-brand-text">No dishes match.</h3>
            <p className="font-body text-sm text-brand-text-secondary mt-1.5">
              {debouncedSearch ? <>We couldn't find anything for <span className="font-semibold">"{debouncedSearch}"</span>.</> : "Try adjusting your filters."}
            </p>
            <div className="mt-5">
              <div className="text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold mb-2">Try searching for</div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {SEARCH_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    data-testid={`search-suggest-${s.toLowerCase()}`}
                    onClick={() => { setSearch(s); setAutoOpen(false); }}
                    className="px-3 py-1 rounded-full border border-brand-border text-xs font-body font-medium text-brand-text hover:border-brand-primary hover:text-brand-primary transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {activeCount > 0 && (
              <button onClick={resetFilters} data-testid="no-results-reset-btn" className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-primary text-white text-xs font-body font-semibold hover:bg-brand-primary-hover">
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {[...grouped.entries()].map(([slug, sectionItems]) => {
              const cat = categories.find((c) => c.slug === slug);
              return (
                <section
                  key={slug}
                  ref={(el) => { if (el) sectionRefs.current[slug] = el; }}
                  data-testid={`section-${slug}`}
                  className="scroll-mt-36"
                >
                  <div className="flex items-end justify-between mb-4">
                    <h2 className="font-heading text-2xl sm:text-3xl font-bold text-brand-text capitalize">
                      {cat?.name || slug}
                    </h2>
                    <span className="text-xs text-brand-text-secondary">{sectionItems.length} {sectionItems.length === 1 ? "dish" : "dishes"}</span>
                  </div>
                  <div className={viewMode === "grid"
                    ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
                    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
                  }>
                    {sectionItems.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        viewMode={viewMode}
                        quickViewEnabled={quickViewEnabled}
                        onQuickView={(e) => handleCardClick(e, item)}
                        onAdd={(e) => handleAdd(e, item)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        dietaryOptions={dietaryOptions}
        activeDietary={activeDietary}
        onToggleDietary={toggleDietary}
        priceRange={priceRange}
        onPriceChange={setPriceRange}
        priceBounds={priceBounds}
        inStockOnly={inStockOnly}
        onStockToggle={setInStockOnly}
        showInStock={showInStockToggle}
        onReset={resetFilters}
        activeCount={activeCount}
      />

      {quickViewEnabled && (
        <QuickViewModal
          itemId={quickViewId}
          open={!!quickViewId}
          onClose={() => setQuickViewId(null)}
        />
      )}
    </div>
  );
}

function ItemCard({ item, viewMode, quickViewEnabled, onQuickView, onAdd }) {
  const isSoldOut = item.status === "sold_out";
  const cardProps = quickViewEnabled
    ? { role: "button", tabIndex: 0, onClick: onQuickView, onKeyDown: (e) => { if (e.key === "Enter") onQuickView(e); } }
    : {};
  const CardTag = quickViewEnabled ? "div" : Link;
  const extraProps = quickViewEnabled ? {} : { to: `/product/${item.id}` };

  return (
    <CardTag
      data-testid={`menu-item-${item.id}`}
      className={`product-card group bg-brand-surface rounded-2xl overflow-hidden border border-brand-border cursor-pointer ${isSoldOut ? "opacity-70" : ""} ${viewMode === "list" ? "flex flex-row sm:flex-col" : "flex flex-col"}`}
      {...extraProps}
      {...cardProps}
    >
      <div className={`relative overflow-hidden bg-brand-bg flex-shrink-0 ${viewMode === "list" ? "w-28 h-28 sm:w-auto sm:h-auto sm:aspect-[4/3]" : "aspect-square"}`}>
        <img src={item.image} alt={item.name} loading="lazy"
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${isSoldOut ? "grayscale" : ""}`} />
        {quickViewEnabled && !isSoldOut && (
          <button
            data-testid={`quickview-btn-${item.id}`}
            onClick={onQuickView}
            aria-label="Quick view"
            className="absolute top-2 left-2 w-8 h-8 rounded-full bg-brand-surface/90 text-brand-text flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-brand-primary hover:text-white"
          >
            <Eye size={14} />
          </button>
        )}
        {item.tags?.length > 0 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-body font-semibold uppercase tracking-wider rounded bg-brand-orange text-white">{item.tags[0]}</span>
        )}
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="px-3 py-1 bg-red-600 text-white text-[10px] font-body font-bold uppercase tracking-wider rounded">Sold Out</span>
          </div>
        )}
      </div>
      <div className="p-3 sm:p-4 flex flex-col justify-center flex-1 min-w-0">
        <h3 className={`font-heading text-sm sm:text-base font-bold truncate sm:whitespace-normal ${isSoldOut ? "text-brand-text-secondary line-through" : "text-brand-text"}`}>{item.name}</h3>
        {item.rating_count > 0 && (
          <div data-testid={`menu-rating-${item.id}`} className="mt-1 inline-flex items-center gap-1 text-[11px] text-brand-text-secondary">
            <Star size={11} className="fill-amber-400 text-amber-400" strokeWidth={1.5} />
            <span className="font-semibold text-brand-text">{Number(item.rating_avg || 0).toFixed(1)}</span>
            <span>({item.rating_count})</span>
          </div>
        )}
        <p className="font-body text-[10px] sm:text-xs text-brand-text-secondary mt-1 leading-relaxed line-clamp-2">{item.description}</p>
        {item.dietary_tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.dietary_tags.slice(0, 3).map((t) => (
              <span key={t} className="px-1.5 py-0.5 rounded-full text-[9px] font-body font-medium bg-brand-bg border border-brand-border text-brand-text-secondary capitalize">
                {t.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-2 sm:mt-3">
          <span className={`font-heading text-base sm:text-lg font-bold ${isSoldOut ? "text-brand-text-secondary" : "text-brand-primary"}`}>${item.price?.toFixed(2)}</span>
          {!isSoldOut && (
            <button data-testid={`add-to-cart-${item.id}`} onClick={onAdd}
              className="w-9 h-9 rounded-full border border-brand-border flex items-center justify-center hover:bg-brand-primary hover:text-white hover:border-brand-primary active:scale-90 transition-all duration-200">
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>
    </CardTag>
  );
}
