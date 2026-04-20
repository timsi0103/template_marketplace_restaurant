import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, ArrowLeft } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useSeo } from "@/hooks/useSeo";

const API_BASE = "/api";

export default function CategoryLandingPage() {
  const { slug } = useParams();
  useSeo("category", { category_slug: slug });
  const [category, setCategory] = useState(null);
  const [items, setItems] = useState([]);
  const [activeSub, setActiveSub] = useState("all");
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [catResp, itemsResp] = await Promise.all([
          fetch(`${API_BASE}/categories/${slug}`),
          fetch(`${API_BASE}/menu/items?category=${slug}`),
        ]);
        const catData = await catResp.json();
        const itemsData = await itemsResp.json();
        setCategory(catData);
        setItems(itemsData.items || []);
        setActiveSub("all");
      } catch {
        setCategory(null);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  // Re-fetch when subcategory changes
  useEffect(() => {
    if (!slug) return;
    const params = new URLSearchParams({ category: slug });
    if (activeSub && activeSub !== "all") params.set("subcategory", activeSub);
    fetch(`${API_BASE}/menu/items?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => {});
  }, [activeSub, slug]);

  const handleAdd = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.status === "sold_out") return;
    addItem({ id: item.id, name: item.name, price: item.price, image: item.image });
  };

  if (loading) {
    return <div className="min-h-screen flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!category) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-body text-sm text-brand-text-secondary">Category not found</p>
        <Link to="/menu" className="font-body text-sm text-brand-primary">Back to Menu</Link>
      </div>
    );
  }

  const subcategories = category.subcategories || [];

  return (
    <div data-testid="category-landing-page" className="min-h-screen">
      {/* Hero */}
      {category.image && (
        <div data-testid="category-hero" className="relative h-48 sm:h-64 lg:h-80 overflow-hidden">
          <img src={category.image} alt={category.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-6 sm:bottom-10 left-0 right-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link to="/menu" className="inline-flex items-center gap-1.5 font-body text-xs text-white/70 hover:text-white mb-3 transition-colors">
              <ArrowLeft size={12} /> All Categories
            </Link>
            <h1 data-testid="category-name" className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
              {category.name}
            </h1>
            {category.description && (
              <p data-testid="category-description" className="font-body text-sm text-white/80 mt-2 max-w-lg leading-relaxed">
                {category.description}
              </p>
            )}
          </div>
        </div>
      )}

      {!category.image && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
          <Link to="/menu" className="inline-flex items-center gap-1.5 font-body text-sm text-brand-text-secondary hover:text-brand-text mb-4 transition-colors">
            <ArrowLeft size={14} /> All Categories
          </Link>
          <h1 data-testid="category-name" className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-brand-text tracking-tight">
            {category.name}
          </h1>
          {category.description && (
            <p data-testid="category-description" className="font-body text-sm text-brand-text-secondary mt-2 max-w-lg leading-relaxed">
              {category.description}
            </p>
          )}
        </div>
      )}

      {/* Subcategory bar */}
      {subcategories.length > 0 && (
        <div data-testid="subcategory-bar" className="sticky top-16 md:top-[65px] z-30 bg-brand-bg/95 backdrop-blur-sm border-b border-brand-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex gap-2.5 overflow-x-auto hide-scrollbar scroll-snap-x">
              <button
                data-testid="subcategory-all"
                onClick={() => setActiveSub("all")}
                className={`font-body text-xs sm:text-sm px-4 sm:px-5 py-2 rounded-full border whitespace-nowrap flex-shrink-0 active:scale-95 transition-all ${activeSub === "all" ? "bg-brand-orange text-white border-brand-orange" : "bg-brand-surface text-brand-text-secondary border-brand-border"}`}
              >
                All {category.name}
              </button>
              {subcategories.filter(s => s.visible !== false).map((sub) => (
                <button
                  key={sub.id}
                  data-testid={`subcategory-${sub.slug}`}
                  onClick={() => setActiveSub(sub.slug)}
                  className={`font-body text-xs sm:text-sm px-4 sm:px-5 py-2 rounded-full border whitespace-nowrap flex-shrink-0 active:scale-95 transition-all ${activeSub === sub.slug ? "bg-brand-orange text-white border-brand-orange" : "bg-brand-surface text-brand-text-secondary border-brand-border"}`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filtered Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {items.length === 0 ? (
          <div className="text-center py-16"><p className="font-body text-sm text-brand-text-secondary">No items in this category yet.</p></div>
        ) : (
          <div data-testid="category-items-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
            {items.map((item) => {
              const isSoldOut = item.status === "sold_out";
              return (
                <Link key={item.id} to={`/product/${item.id}`} data-testid={`cat-item-${item.id}`}
                  className={`product-card group bg-brand-surface rounded-2xl overflow-hidden border border-brand-border flex flex-row sm:flex-col ${isSoldOut ? "opacity-70" : ""}`}
                >
                  <div className="relative overflow-hidden bg-brand-bg flex-shrink-0 w-28 h-28 sm:w-auto sm:h-auto sm:aspect-[4/3]">
                    <img src={item.image} alt={item.name} className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isSoldOut ? "grayscale" : ""}`} />
                    {isSoldOut && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <span className="px-3 py-1 bg-red-600 text-white text-[10px] font-body font-bold uppercase tracking-wider rounded">Sold Out</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 sm:p-5 flex flex-col justify-center flex-1 min-w-0">
                    <h3 className={`font-heading text-sm sm:text-base font-bold truncate sm:whitespace-normal ${isSoldOut ? "text-brand-text-secondary line-through" : "text-brand-text"}`}>
                      {item.name}
                    </h3>
                    <p className="font-body text-[10px] sm:text-xs text-brand-text-secondary mt-1 line-clamp-2">{item.description}</p>
                    <div className="flex items-center justify-between mt-2 sm:mt-4">
                      <span className={`font-heading text-base sm:text-lg font-bold ${isSoldOut ? "text-brand-text-secondary" : "text-brand-primary"}`}>${item.price?.toFixed(2)}</span>
                      {!isSoldOut && (
                        <button data-testid={`cat-add-${item.id}`} onClick={(e) => handleAdd(e, item)}
                          className="w-9 h-9 sm:w-8 sm:h-8 rounded-full border border-brand-border flex items-center justify-center hover:bg-brand-primary hover:text-white hover:border-brand-primary active:scale-90 transition-all">
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
