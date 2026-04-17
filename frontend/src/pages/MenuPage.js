import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

// Use relative URL to avoid CORS redirect issues
const API_BASE = "/api";
const CATEGORIES = [
  { label: "All Offerings", value: "all" },
  { label: "Starters", value: "starters" },
  { label: "Mains", value: "mains" },
  { label: "Drinks", value: "drinks" },
  { label: "Desserts", value: "desserts" },
];

export default function MenuPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchItems = async () => {
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
    setLoading(true);
    fetchItems();
  }, [activeCategory]);

  const handleAdd = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.status === "sold_out") return;
    addItem({ id: item.id, name: item.name, price: item.price, image: item.image });
  };

  return (
    <div data-testid="menu-page" className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 lg:pt-14">
        <div className="mb-4 sm:mb-10">
          <h1 data-testid="menu-title" className="font-heading text-3xl sm:text-5xl lg:text-6xl font-bold text-brand-text tracking-tight leading-none">
            The Collection
          </h1>
          <p data-testid="menu-subtitle" className="font-body text-xs sm:text-base text-brand-text-secondary mt-2 sm:mt-3 max-w-xl leading-relaxed">
            A curated selection of our finest offerings, designed to elevate your palate and transform the everyday dining experience into an editorial moment.
          </p>
        </div>
      </div>

      {/* Sticky horizontal scrollable category bar */}
      <div data-testid="category-filters" className="sticky top-16 md:top-[65px] z-30 bg-brand-bg/95 backdrop-blur-sm border-b border-brand-border sm:border-b-0 sm:static sm:bg-transparent sm:backdrop-blur-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-0 sm:mb-10">
          <div ref={scrollRef} className="flex gap-2.5 sm:gap-3 overflow-x-auto hide-scrollbar scroll-snap-x">
            {CATEGORIES.map((cat) => (
              <button key={cat.value} data-testid={`category-${cat.value}`} onClick={() => setActiveCategory(cat.value)}
                className={`font-body text-xs sm:text-sm px-4 sm:px-5 py-2 rounded-full border transition-all duration-200 whitespace-nowrap flex-shrink-0 active:scale-95 ${activeCategory === cat.value ? "bg-brand-orange text-white border-brand-orange" : "bg-brand-surface text-brand-text-secondary border-brand-border sm:bg-transparent"}`}
              >{cat.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 sm:pb-14 pt-4 sm:pt-0">
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
                    {item.status === "seasonal" && !isSoldOut && (
                      <span className="absolute top-2 right-2 sm:top-3 sm:right-3 px-2 py-0.5 bg-amber-500 text-white text-[9px] font-body font-semibold uppercase rounded">Seasonal</span>
                    )}
                  </div>
                  <div className="p-3 sm:p-5 flex flex-col justify-center flex-1 min-w-0">
                    <h3 className={`font-heading text-sm sm:text-base font-bold truncate sm:whitespace-normal ${isSoldOut ? "text-brand-text-secondary line-through" : "text-brand-text"}`}>
                      {item.name}
                    </h3>
                    <p className="font-body text-[10px] sm:text-xs text-brand-text-secondary mt-1 sm:mt-2 leading-relaxed line-clamp-2 hidden sm:block">{item.description}</p>
                    <p className="font-body text-[10px] text-brand-text-secondary mt-0.5 line-clamp-1 sm:hidden">{item.description}</p>
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
