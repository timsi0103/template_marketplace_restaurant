import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, ChevronDown } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

const API_BASE = "/api";

export default function MenuPage() {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeSubcategory, setActiveSubcategory] = useState(null);
  const [showSubDropdown, setShowSubDropdown] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  // Fetch categories
  useEffect(() => {
    fetch(`${API_BASE}/categories/tree`)
      .then(r => r.json())
      .then(d => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowSubDropdown(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch items
  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        const url = activeCategory === "all" ? `${API_BASE}/menu/items` : `${API_BASE}/menu/items?category=${activeCategory}`;
        const resp = await fetch(url);
        const data = await resp.json();
        setItems(data.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [activeCategory]);

  const handleCategoryClick = (slug) => {
    if (slug === activeCategory && slug !== "all") {
      setShowSubDropdown(!showSubDropdown);
    } else {
      setActiveCategory(slug);
      setActiveSubcategory(null);
      setShowSubDropdown(false);
      if (slug !== "all") {
        const cat = categories.find(c => c.slug === slug);
        if (cat?.subcategories?.length > 0) {
          setShowSubDropdown(true);
        }
      }
    }
  };

  const handleSubClick = (subSlug) => {
    setActiveSubcategory(subSlug);
    setShowSubDropdown(false);
  };

  const activeCat = categories.find(c => c.slug === activeCategory);
  const subcategories = activeCat?.subcategories?.filter(s => s.visible !== false) || [];

  const handleAdd = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.status === "sold_out") return;
    addItem({ id: item.id, name: item.name, price: item.price, image: item.image });
  };

  return (
    <div data-testid="menu-page" className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 lg:pt-14">
        <div className="mb-6 sm:mb-10">
          <h1 data-testid="menu-title" className="font-heading text-3xl sm:text-5xl lg:text-6xl font-bold text-brand-text tracking-tight leading-none">
            The Collection
          </h1>
          <p data-testid="menu-subtitle" className="font-body text-xs sm:text-base text-brand-text-secondary mt-2 sm:mt-3 max-w-xl leading-relaxed">
            A curated selection of our finest offerings, designed to elevate your palate.
          </p>
        </div>

        {/* Top-level category bar with images */}
        {categories.length > 0 && (
          <div data-testid="category-nav" className="mb-6 sm:mb-8">
            <div className="flex gap-3 sm:gap-4 overflow-x-auto hide-scrollbar scroll-snap-x pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              {/* All button */}
              <button
                data-testid="category-all"
                onClick={() => { setActiveCategory("all"); setActiveSubcategory(null); setShowSubDropdown(false); }}
                className={`flex flex-col items-center gap-2 flex-shrink-0 group transition-all ${activeCategory === "all" ? "" : "opacity-60 hover:opacity-100"}`}
              >
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 transition-all ${activeCategory === "all" ? "border-brand-primary shadow-md" : "border-brand-border"}`}>
                  <div className="w-full h-full bg-brand-primary/10 flex items-center justify-center">
                    <span className="font-heading text-xl sm:text-2xl font-bold text-brand-primary">All</span>
                  </div>
                </div>
                <span className={`font-body text-[10px] sm:text-xs font-medium text-center ${activeCategory === "all" ? "text-brand-text" : "text-brand-text-secondary"}`}>
                  All
                </span>
              </button>

              {categories.filter(c => c.visible !== false).map((cat) => (
                <div key={cat.id} className="relative" ref={activeCategory === cat.slug ? dropdownRef : null}>
                  <button
                    data-testid={`category-${cat.slug}`}
                    onClick={() => handleCategoryClick(cat.slug)}
                    className={`flex flex-col items-center gap-2 flex-shrink-0 group transition-all ${activeCategory === cat.slug ? "" : "opacity-60 hover:opacity-100"}`}
                  >
                    <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 transition-all ${activeCategory === cat.slug ? "border-brand-primary shadow-md" : "border-brand-border"}`}>
                      {cat.image ? (
                        <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-brand-bg flex items-center justify-center">
                          <span className="font-heading text-lg font-bold text-brand-text-secondary">{cat.name.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <span className={`font-body text-[10px] sm:text-xs font-medium text-center ${activeCategory === cat.slug ? "text-brand-text" : "text-brand-text-secondary"}`}>
                        {cat.name}
                      </span>
                      {cat.subcategories?.length > 0 && (
                        <ChevronDown size={10} className={`text-brand-text-secondary transition-transform ${activeCategory === cat.slug && showSubDropdown ? "rotate-180" : ""}`} />
                      )}
                    </div>
                  </button>

                  {/* Subcategory dropdown */}
                  {activeCategory === cat.slug && showSubDropdown && subcategories.length > 0 && (
                    <div data-testid={`subcategory-dropdown-${cat.slug}`} className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-brand-surface border border-brand-border rounded-xl shadow-lg py-2 z-40 min-w-[160px]">
                      <button
                        data-testid={`sub-all-${cat.slug}`}
                        onClick={() => handleSubClick(null)}
                        className={`w-full text-left px-4 py-2 font-body text-sm transition-colors ${!activeSubcategory ? "text-brand-primary font-semibold bg-brand-bg" : "text-brand-text hover:bg-brand-bg"}`}
                      >
                        All {cat.name}
                      </button>
                      {subcategories.map((sub) => (
                        <button
                          key={sub.id}
                          data-testid={`sub-${sub.slug}`}
                          onClick={() => handleSubClick(sub.slug)}
                          className={`w-full text-left px-4 py-2 font-body text-sm transition-colors ${activeSubcategory === sub.slug ? "text-brand-primary font-semibold bg-brand-bg" : "text-brand-text hover:bg-brand-bg"}`}
                        >
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active subcategory secondary bar (mobile-friendly) */}
        {subcategories.length > 0 && !showSubDropdown && (
          <div data-testid="subcategory-pills" className="mb-6 sm:mb-8">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar scroll-snap-x">
              <button
                onClick={() => setActiveSubcategory(null)}
                className={`font-body text-xs px-4 py-1.5 rounded-full border whitespace-nowrap flex-shrink-0 active:scale-95 transition-all ${!activeSubcategory ? "bg-brand-orange text-white border-brand-orange" : "bg-brand-surface text-brand-text-secondary border-brand-border"}`}
              >
                All {activeCat?.name}
              </button>
              {subcategories.map((sub) => (
                <button
                  key={sub.id}
                  data-testid={`pill-${sub.slug}`}
                  onClick={() => setActiveSubcategory(sub.slug)}
                  className={`font-body text-xs px-4 py-1.5 rounded-full border whitespace-nowrap flex-shrink-0 active:scale-95 transition-all ${activeSubcategory === sub.slug ? "bg-brand-orange text-white border-brand-orange" : "bg-brand-surface text-brand-text-secondary border-brand-border"}`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category landing CTA */}
        {activeCategory !== "all" && activeCat && (
          <Link to={`/menu/${activeCat.slug}`} data-testid="view-category-link" className="inline-flex items-center gap-1 font-body text-xs text-brand-primary font-medium mb-4 hover:text-brand-primary-hover transition-colors">
            View full {activeCat.name} collection &rarr;
          </Link>
        )}
      </div>

      {/* Product Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 sm:pb-14">
        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-20"><p className="font-body text-sm text-brand-text-secondary">No items in this category yet.</p></div>
        ) : (
          <div data-testid="product-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
            {items.map((item) => {
              const isSoldOut = item.status === "sold_out";
              return (
                <Link key={item.id} to={`/product/${item.id}`} data-testid={`menu-item-${item.id}`}
                  className={`product-card group bg-brand-surface rounded-2xl overflow-hidden border border-brand-border flex flex-row sm:flex-col ${isSoldOut ? "opacity-70" : ""}`}
                >
                  <div className="relative overflow-hidden bg-brand-bg flex-shrink-0 w-28 h-28 sm:w-auto sm:h-auto sm:aspect-[4/3]">
                    <img src={item.image} alt={item.name} className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isSoldOut ? "grayscale" : ""}`} />
                    {item.tags?.length > 0 && (
                      <span className={`absolute top-2 left-2 sm:top-3 sm:left-3 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[10px] font-body font-semibold uppercase tracking-wider rounded ${item.tags[0] === "CHEF'S SIGNATURE" || item.tags[0] === "CHEF'S SELECTION" ? "bg-brand-orange text-white" : "bg-brand-surface text-brand-text border border-brand-border"}`}>
                        {item.tags[0]}
                      </span>
                    )}
                    {isSoldOut && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <span data-testid={`sold-out-badge-${item.id}`} className="px-3 py-1 bg-red-600 text-white text-[10px] font-body font-bold uppercase tracking-wider rounded">Sold Out</span>
                      </div>
                    )}
                    {item.status === "seasonal" && (
                      <span className="absolute top-2 right-2 sm:top-3 sm:right-3 px-2 py-0.5 bg-amber-500 text-white text-[9px] font-body font-semibold uppercase rounded">Seasonal</span>
                    )}
                  </div>
                  <div className="p-3 sm:p-5 flex flex-col justify-center flex-1 min-w-0">
                    <h3 className={`font-heading text-sm sm:text-base font-bold truncate sm:whitespace-normal ${isSoldOut ? "text-brand-text-secondary line-through" : "text-brand-text"}`}>
                      {item.name}
                    </h3>
                    <p className="font-body text-[10px] sm:text-xs text-brand-text-secondary mt-1 sm:mt-2 leading-relaxed line-clamp-2">{item.description}</p>
                    <div className="flex items-center justify-between mt-2 sm:mt-4">
                      <span className={`font-heading text-base sm:text-lg font-bold ${isSoldOut ? "text-brand-text-secondary" : "text-brand-primary"}`}>
                        ${item.price?.toFixed(2)}
                      </span>
                      {!isSoldOut && (
                        <button data-testid={`add-to-cart-${item.id}`} onClick={(e) => handleAdd(e, item)}
                          className="w-9 h-9 sm:w-8 sm:h-8 rounded-full border border-brand-border flex items-center justify-center hover:bg-brand-primary hover:text-white hover:border-brand-primary active:scale-90 transition-all duration-200">
                          <Plus size={16} />
                        </button>
                      )}
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
