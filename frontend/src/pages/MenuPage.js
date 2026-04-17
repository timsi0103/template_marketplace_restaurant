import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

const categories = [
  "All Offerings",
  "Appetizers",
  "Main Courses",
  "Artisan Sides",
  "Libations",
];

const menuItems = [
  {
    id: 1,
    name: "Heritage Duck Breast",
    description: "Pan-seared to a perfect medium-rare, accompanied by a tart Montmorency cherry...",
    price: 42,
    priceLabel: "$42.00",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop",
    tag: null,
    featured: true,
  },
  {
    id: 2,
    name: "Heirloom Burrata",
    description: "Hand-pulled artisan burrata, blistered vine tomatoes, fresh basil pesto, and 12-year aged...",
    price: 24,
    priceLabel: "$24.00",
    image: "https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400&h=400&fit=crop",
    tag: null,
    featured: false,
  },
  {
    id: 3,
    name: "Earth Harvest Bowl",
    description: "Tri-color quinoa, fire-roasted root vegetables, Hass avocado, and a toasted sesame tahini...",
    price: 18,
    priceLabel: "$18.00",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop",
    tag: null,
    featured: false,
  },
  {
    id: 4,
    name: "Artisan Diavola",
    description: "72-hour sourdough crust, San Marzano tomato base, spicy Calabrian salami, and local hot...",
    price: 26,
    priceLabel: "$26.00",
    image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop",
    tag: "WOOD-FIRED",
    featured: false,
  },
  {
    id: 5,
    name: "Hazelnut Ganache Tart",
    description: "Dark chocolate ganache, roasted Piedmont hazelnuts, sea salt flakes, and a delicate butte...",
    price: 14,
    priceLabel: "$14.00",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&h=400&fit=crop",
    tag: null,
    featured: false,
  },
  {
    id: 6,
    name: "Truffle Infused Tagliatelle",
    description: "Fresh hand-cut pasta with black truffle shavings, aged parmesan, and brown butter...",
    price: 34,
    priceLabel: "$34.00",
    image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=400&h=400&fit=crop",
    tag: "CHEF'S SIGNATURE",
    featured: false,
  },
];

export default function MenuPage() {
  const [activeCategory, setActiveCategory] = useState("All Offerings");
  const { addItem } = useCart();
  const scrollRef = useRef(null);

  const handleAdd = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({ id: item.id, name: item.name, price: item.price, image: item.image });
  };

  return (
    <div data-testid="menu-page" className="min-h-screen">
      {/* Page Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 lg:pt-14">
        <div className="mb-4 sm:mb-10">
          <h1
            data-testid="menu-title"
            className="font-heading text-3xl sm:text-5xl lg:text-6xl font-bold text-brand-text tracking-tight leading-none"
          >
            The Collection
          </h1>
          <p
            data-testid="menu-subtitle"
            className="font-body text-xs sm:text-base text-brand-text-secondary mt-2 sm:mt-3 max-w-xl leading-relaxed"
          >
            A curated selection of our finest offerings, designed to elevate your
            palate and transform the everyday dining experience into an editorial moment.
          </p>
        </div>
      </div>

      {/* Sticky horizontal scrollable category bar */}
      <div
        data-testid="category-filters"
        className="sticky top-16 md:top-[65px] z-30 bg-brand-bg/95 backdrop-blur-sm border-b border-brand-border sm:border-b-0 sm:static sm:bg-transparent sm:backdrop-blur-none"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-0 sm:mb-10">
          <div
            ref={scrollRef}
            className="flex gap-2.5 sm:gap-3 overflow-x-auto hide-scrollbar scroll-snap-x"
          >
            {categories.map((cat) => (
              <button
                key={cat}
                data-testid={`category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => setActiveCategory(cat)}
                className={`font-body text-xs sm:text-sm px-4 sm:px-5 py-2 rounded-full border transition-all duration-200 whitespace-nowrap flex-shrink-0 active:scale-95 ${
                  activeCategory === cat
                    ? "bg-brand-orange text-white border-brand-orange"
                    : "bg-brand-surface text-brand-text-secondary border-brand-border sm:bg-transparent"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product Grid — full-width on mobile, grid on desktop */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 sm:pb-14 pt-4 sm:pt-0">
        <div
          data-testid="product-grid"
          className="flex flex-col gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-8"
        >
          {menuItems.map((item) => {
            const isFeatured = item.featured;
            return (
              <Link
                key={item.id}
                to={`/product/${item.id}`}
                data-testid={`menu-item-${item.id}`}
                className={`product-card group bg-brand-surface rounded-2xl overflow-hidden border border-brand-border ${
                  isFeatured
                    ? "sm:col-span-2 flex flex-row sm:grid sm:grid-cols-2"
                    : "flex flex-row sm:flex-col"
                }`}
              >
                {/* Image */}
                <div
                  className={`relative overflow-hidden bg-brand-bg flex-shrink-0 ${
                    isFeatured
                      ? "w-28 h-28 sm:w-auto sm:h-auto sm:aspect-[4/3]"
                      : "w-28 h-28 sm:w-auto sm:h-auto sm:aspect-[4/3]"
                  }`}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {item.tag && (
                    <span
                      className={`absolute top-2 left-2 sm:top-3 sm:left-3 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[10px] font-body font-semibold uppercase tracking-wider rounded ${
                        item.tag === "CHEF'S SIGNATURE"
                          ? "bg-brand-orange text-white"
                          : "bg-brand-surface text-brand-text border border-brand-border"
                      }`}
                    >
                      {item.tag}
                    </span>
                  )}
                </div>
                {/* Info */}
                <div className="p-3 sm:p-5 flex flex-col justify-center flex-1 min-w-0">
                  <h3
                    className={`font-heading font-bold text-brand-text truncate sm:whitespace-normal ${
                      isFeatured ? "text-base sm:text-xl lg:text-2xl" : "text-sm sm:text-base"
                    }`}
                  >
                    {item.name}
                  </h3>
                  <p className="font-body text-[10px] sm:text-xs text-brand-text-secondary mt-1 sm:mt-2 leading-relaxed line-clamp-2 hidden sm:block">
                    {item.description}
                  </p>
                  <p className="font-body text-[10px] text-brand-text-secondary mt-0.5 line-clamp-1 sm:hidden">
                    {item.description}
                  </p>
                  <div className="flex items-center justify-between mt-2 sm:mt-4">
                    <span className="font-heading text-base sm:text-lg font-bold text-brand-primary">
                      {item.priceLabel}
                    </span>
                    <button
                      data-testid={`add-to-cart-${item.id}`}
                      onClick={(e) => handleAdd(e, item)}
                      className={`flex items-center justify-center active:scale-90 transition-all duration-200 ${
                        isFeatured
                          ? "hidden sm:inline-flex gap-2 px-4 py-2 bg-brand-orange text-white text-xs font-body font-semibold uppercase tracking-wider rounded-full hover:bg-brand-orange-hover"
                          : ""
                      }`}
                    >
                      {isFeatured ? (
                        <>ADD <ShoppingIcon /></>
                      ) : (
                        <span className="w-9 h-9 sm:w-8 sm:h-8 rounded-full border border-brand-border flex items-center justify-center hover:bg-brand-primary hover:text-white hover:border-brand-primary">
                          <Plus size={16} />
                        </span>
                      )}
                    </button>
                    {/* Mobile add for featured */}
                    {isFeatured && (
                      <button
                        data-testid={`add-to-cart-mobile-${item.id}`}
                        onClick={(e) => handleAdd(e, item)}
                        className="sm:hidden w-9 h-9 rounded-full border border-brand-border flex items-center justify-center active:scale-90 active:bg-brand-primary active:text-white active:border-brand-primary transition-all"
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ShoppingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="m1 1 4 2 2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  );
}
