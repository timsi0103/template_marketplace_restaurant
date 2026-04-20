import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, LayoutGrid, List } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

const API_BASE = "/api";

function SkeletonCard({ isGrid }) {
  if (isGrid) {
    return (
      <div data-testid="skeleton-card" className="rounded-2xl overflow-hidden bg-brand-surface border border-brand-border">
        <div className="aspect-square bg-brand-border/40 skeleton-shimmer" />
      </div>
    );
  }
  return (
    <div data-testid="skeleton-card" className="rounded-2xl overflow-hidden bg-brand-surface border border-brand-border flex flex-row sm:flex-col">
      <div className="flex-shrink-0 w-28 h-28 sm:w-auto sm:h-auto sm:aspect-[4/3] bg-brand-border/40 skeleton-shimmer" />
      <div className="p-3 sm:p-5 flex flex-col justify-center flex-1 min-w-0 gap-2">
        <div className="h-4 w-3/4 bg-brand-border/40 rounded skeleton-shimmer" />
        <div className="h-3 w-full bg-brand-border/30 rounded skeleton-shimmer hidden sm:block" />
        <div className="h-3 w-1/2 bg-brand-border/30 rounded skeleton-shimmer hidden sm:block" />
        <div className="flex items-center justify-between mt-2">
          <div className="h-5 w-16 bg-brand-border/40 rounded skeleton-shimmer" />
          <div className="w-8 h-8 bg-brand-border/30 rounded-full skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

export default function MenuPage() {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeSubcategory, setActiveSubcategory] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("list");
  const { addItem } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/categories/tree`).then(r => r.json()).then(d => setCategories(d.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = activeCategory === "all" ? `${API_BASE}/menu/items` : `${API_BASE}/menu/items?category=${activeCategory}`;
    fetch(url).then(r => r.json()).then(d => setItems(d.items || [])).catch(() => setItems([])).finally(() => setLoading(false));
  }, [activeCategory]);

  const handleCategoryClick = (slug) => {
    if (slug !== activeCategory) {
      setActiveCategory(slug);
      setActiveSubcategory(null);
    }
  };

  const activeCat = categories.find(c => c.slug === activeCategory);
  const subcategories = activeCat?.subcategories?.filter(s => s.visible !== false) || [];

  const handleAdd = (e, item) => {
    e.preventDefault(); e.stopPropagation();
    if (item.status === "sold_out") return;
    addItem({ id: item.id, name: item.name, price: item.price, image: item.image });
  };

  return (
    <div data-testid="menu-page" className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 lg:pt-14">
        <div className="flex items-end justify-between mb-6 sm:mb-10">
          <div>
            <h1 data-testid="menu-title" className="font-heading text-3xl sm:text-5xl lg:text-6xl font-bold text-brand-text tracking-tight leading-none">The Collection</h1>
            <p data-testid="menu-subtitle" className="font-body text-xs sm:text-base text-brand-text-secondary mt-2 sm:mt-3 max-w-xl leading-relaxed">A curated selection of our finest offerings, designed to elevate your palate.</p>
          </div>
          {/* View Mode Toggle */}
          <div data-testid="view-toggle" className="hidden sm:flex items-center gap-1 bg-brand-surface border border-brand-border rounded-lg p-1">
            <button data-testid="view-list-btn" onClick={() => setViewMode("list")} className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-brand-primary text-white" : "text-brand-text-secondary hover:text-brand-text"}`}>
              <List size={16} />
            </button>
            <button data-testid="view-grid-btn" onClick={() => setViewMode("grid")} className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${viewMode === "grid" ? "bg-brand-primary text-white" : "text-brand-text-secondary hover:text-brand-text"}`}>
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>

        {/* Category Nav */}
        {categories.length > 0 && (
          <div data-testid="category-nav" className="mb-6 sm:mb-8">
            <div className="flex gap-3 sm:gap-4 overflow-x-auto hide-scrollbar scroll-snap-x pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              <button data-testid="category-all" onClick={() => { setActiveCategory("all"); setActiveSubcategory(null); }}
                className={`flex flex-col items-center gap-2 flex-shrink-0 transition-all ${activeCategory === "all" ? "" : "opacity-60 hover:opacity-100"}`}>
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 transition-all ${activeCategory === "all" ? "border-brand-primary shadow-md" : "border-brand-border"}`}>
                  <div className="w-full h-full bg-brand-primary/10 flex items-center justify-center"><span className="font-heading text-xl sm:text-2xl font-bold text-brand-primary">All</span></div>
                </div>
                <span className={`font-body text-[10px] sm:text-xs font-medium ${activeCategory === "all" ? "text-brand-text" : "text-brand-text-secondary"}`}>All</span>
              </button>
              {categories.filter(c => c.visible !== false).map((cat) => (
                <button key={cat.id} data-testid={`category-${cat.slug}`} onClick={() => handleCategoryClick(cat.slug)}
                  className={`flex flex-col items-center gap-2 flex-shrink-0 transition-all ${activeCategory === cat.slug ? "" : "opacity-60 hover:opacity-100"}`}>
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 transition-all ${activeCategory === cat.slug ? "border-brand-primary shadow-md" : "border-brand-border"}`}>
                    {cat.image ? <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-brand-bg flex items-center justify-center"><span className="font-heading text-lg font-bold text-brand-text-secondary">{cat.name.charAt(0)}</span></div>}
                  </div>
                  <span className={`font-body text-[10px] sm:text-xs font-medium ${activeCategory === cat.slug ? "text-brand-text" : "text-brand-text-secondary"}`}>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Subcategory pills */}
        {subcategories.length > 0 && (
          <div data-testid="subcategory-pills" className="mb-6 sm:mb-8">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar scroll-snap-x">
              <button data-testid={`pill-all-${activeCat?.slug}`} onClick={() => setActiveSubcategory(null)} className={`font-body text-xs px-4 py-1.5 rounded-full border whitespace-nowrap flex-shrink-0 active:scale-95 transition-all ${!activeSubcategory ? "bg-brand-orange text-white border-brand-orange" : "bg-brand-surface text-brand-text-secondary border-brand-border"}`}>All {activeCat?.name}</button>
              {subcategories.map((sub) => (<button key={sub.id} data-testid={`pill-${sub.slug}`} onClick={() => setActiveSubcategory(sub.slug)} className={`font-body text-xs px-4 py-1.5 rounded-full border whitespace-nowrap flex-shrink-0 active:scale-95 transition-all ${activeSubcategory === sub.slug ? "bg-brand-orange text-white border-brand-orange" : "bg-brand-surface text-brand-text-secondary border-brand-border"}`}>{sub.name}</button>))}
            </div>
          </div>
        )}

        {activeCategory !== "all" && activeCat && (
          <Link to={`/menu/${activeCat.slug}`} data-testid="view-category-link" className="inline-flex items-center gap-1 font-body text-xs text-brand-primary font-medium mb-4 hover:text-brand-primary-hover transition-colors">View full {activeCat.name} collection &rarr;</Link>
        )}
      </div>

      {/* Product Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 sm:pb-14">
        {loading ? (
          /* Skeleton Loading */
          <div data-testid="skeleton-grid" className={viewMode === "grid"
            ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8"
          }>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} isGrid={viewMode === "grid"} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20"><p className="font-body text-sm text-brand-text-secondary">No items in this category yet.</p></div>
        ) : viewMode === "grid" ? (
          /* ── Gallery Grid View ── */
          <div data-testid="gallery-grid" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {items.map((item) => {
              const isSoldOut = item.status === "sold_out";
              return (
                <Link key={item.id} to={`/product/${item.id}`} data-testid={`gallery-item-${item.id}`}
                  className={`group relative rounded-2xl overflow-hidden ${isSoldOut ? "opacity-70" : ""}`}>
                  <div className="aspect-square overflow-hidden bg-brand-bg">
                    <img src={item.image} alt={item.name} loading="lazy"
                      className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${isSoldOut ? "grayscale" : ""}`} />
                  </div>
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  {/* Always-visible bottom info */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                    <h3 className="font-heading text-xs sm:text-sm font-bold text-white line-clamp-1">{item.name}</h3>
                    <span className={`font-heading text-sm sm:text-base font-bold ${isSoldOut ? "text-white/60" : "text-brand-orange"}`}>
                      ${item.price?.toFixed(2)}
                    </span>
                  </div>
                  {/* Tags */}
                  {item.tags?.length > 0 && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 text-[8px] sm:text-[9px] font-body font-semibold uppercase tracking-wider rounded bg-brand-orange text-white">{item.tags[0]}</span>
                  )}
                  {isSoldOut && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-red-600 text-white text-[9px] sm:text-[10px] font-body font-bold uppercase rounded">Sold Out</span>
                    </div>
                  )}
                  {/* Hover Add button */}
                  {!isSoldOut && (
                    <button data-testid={`gallery-add-${item.id}`} onClick={(e) => handleAdd(e, item)}
                      className="absolute top-2 right-2 sm:top-3 sm:right-3 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-brand-surface/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-brand-primary hover:text-white active:scale-90 shadow-md">
                      <Plus size={16} />
                    </button>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          /* ── List View (default) ── */
          <div data-testid="product-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
            {items.map((item) => {
              const isSoldOut = item.status === "sold_out";
              return (
                <Link key={item.id} to={`/product/${item.id}`} data-testid={`menu-item-${item.id}`}
                  className={`product-card group bg-brand-surface rounded-2xl overflow-hidden border border-brand-border flex flex-row sm:flex-col ${isSoldOut ? "opacity-70" : ""}`}>
                  <div className="relative overflow-hidden bg-brand-bg flex-shrink-0 w-28 h-28 sm:w-auto sm:h-auto sm:aspect-[4/3]">
                    <img src={item.image} alt={item.name} loading="lazy"
                      className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${isSoldOut ? "grayscale" : ""}`} />
                    {item.tags?.length > 0 && (
                      <span className={`absolute top-2 left-2 sm:top-3 sm:left-3 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[10px] font-body font-semibold uppercase tracking-wider rounded ${item.tags[0] === "CHEF'S SIGNATURE" || item.tags[0] === "CHEF'S SELECTION" ? "bg-brand-orange text-white" : "bg-brand-surface text-brand-text border border-brand-border"}`}>{item.tags[0]}</span>
                    )}
                    {isSoldOut && (<div className="absolute inset-0 bg-black/30 flex items-center justify-center"><span className="px-3 py-1 bg-red-600 text-white text-[10px] font-body font-bold uppercase tracking-wider rounded">Sold Out</span></div>)}
                    {item.status === "seasonal" && (<span className="absolute top-2 right-2 sm:top-3 sm:right-3 px-2 py-0.5 bg-amber-500 text-white text-[9px] font-body font-semibold uppercase rounded">Seasonal</span>)}
                  </div>
                  <div className="p-3 sm:p-5 flex flex-col justify-center flex-1 min-w-0">
                    <h3 className={`font-heading text-sm sm:text-base font-bold truncate sm:whitespace-normal ${isSoldOut ? "text-brand-text-secondary line-through" : "text-brand-text"}`}>{item.name}</h3>
                    <p className="font-body text-[10px] sm:text-xs text-brand-text-secondary mt-1 sm:mt-2 leading-relaxed line-clamp-2">{item.description}</p>
                    <div className="flex items-center justify-between mt-2 sm:mt-4">
                      <span className={`font-heading text-base sm:text-lg font-bold ${isSoldOut ? "text-brand-text-secondary" : "text-brand-primary"}`}>${item.price?.toFixed(2)}</span>
                      {!isSoldOut && (<button data-testid={`add-to-cart-${item.id}`} onClick={(e) => handleAdd(e, item)}
                        className="w-9 h-9 sm:w-8 sm:h-8 rounded-full border border-brand-border flex items-center justify-center hover:bg-brand-primary hover:text-white hover:border-brand-primary active:scale-90 transition-all duration-200"><Plus size={16} /></button>)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
