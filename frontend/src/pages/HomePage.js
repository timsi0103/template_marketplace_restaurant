import { Link } from "react-router-dom";
import { Heart, Plus, ArrowRight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

const heroProduct = {
  tag: "CHEF'S SELECTION",
  title: "The Artisan Sourdough",
  description:
    "Handcrafted with a 100-year-old starter, offering a perfect, crackling crust and an airy, complex crumb. A testament to time and tradition.",
  price: "$12.00",
  image: "https://images.unsplash.com/photo-1571157577110-493b325fdd3d?w=600&h=400&fit=crop",
};

const collections = [
  {
    id: 1,
    title: "Signature Restaurants",
    subtitle: "Reserve exclusive tables or order the finest meals directly to your door.",
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=700&h=500&fit=crop",
  },
  {
    id: 2,
    title: "Local Bakeries",
    subtitle: "Freshly baked mornings.",
    image: "https://images.unsplash.com/photo-1571157577110-493b325fdd3d?w=400&h=250&fit=crop",
  },
  {
    id: 3,
    title: "D2C Pantry",
    subtitle: "Elevate your home cooking.",
    image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=250&fit=crop",
  },
];

const cravingItems = [
  {
    id: 1,
    name: "Black Truffle Tagliatelle",
    vendor: "Osteria Bianca",
    price: 34,
    priceLabel: "$34",
    image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=300&h=300&fit=crop",
    liked: true,
  },
  {
    id: 2,
    name: "Matcha Mille Crepe",
    vendor: "Lumiere Patisserie",
    price: 14,
    priceLabel: "$14",
    image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=300&h=300&fit=crop",
    liked: false,
  },
  {
    id: 3,
    name: "Reserve Cold Brew",
    vendor: "Kin Coffee Co.",
    price: 22,
    priceLabel: "$22",
    image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300&h=300&fit=crop",
    liked: false,
  },
  {
    id: 4,
    name: "The Umami Smash",
    vendor: "Salt & Sear",
    price: 18,
    priceLabel: "$18",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=300&fit=crop",
    liked: false,
    tag: "POPULAR",
  },
];

export default function HomePage() {
  const { addItem } = useCart();

  const handleAdd = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({ id: item.id, name: item.name, price: item.price, image: item.image });
  };

  return (
    <div data-testid="home-page" className="min-h-screen">
      {/* Hero Section — image on top on mobile, side-by-side on desktop */}
      <section data-testid="hero-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 lg:py-12">
        <div className="bg-brand-surface rounded-2xl overflow-hidden border border-brand-border">
          <div className="flex flex-col-reverse lg:grid lg:grid-cols-2">
            {/* Hero Text */}
            <div className="p-5 sm:p-8 lg:p-12 flex flex-col justify-center">
              <span
                data-testid="hero-tag"
                className="inline-block w-fit px-3 py-1 text-[10px] sm:text-xs font-body font-semibold tracking-widest uppercase bg-brand-orange text-white rounded mb-4 sm:mb-6"
              >
                {heroProduct.tag}
              </span>
              <h1
                data-testid="hero-title"
                className="font-heading text-3xl sm:text-5xl lg:text-6xl font-bold text-brand-text tracking-tight leading-none mb-3 sm:mb-4"
              >
                {heroProduct.title}
              </h1>
              <p
                data-testid="hero-description"
                className="font-body text-xs sm:text-sm text-brand-text-secondary leading-relaxed mb-5 sm:mb-8 max-w-md"
              >
                {heroProduct.description}
              </p>
              <Link
                to="/menu"
                data-testid="hero-cta-btn"
                className="inline-flex items-center justify-center w-fit px-6 py-3 bg-brand-primary text-white font-body text-sm font-medium rounded-full hover:bg-brand-primary-hover active:scale-[0.97] transition-all cta-pulse"
              >
                Taste the Tradition
              </Link>
              <div className="mt-4 sm:mt-6 bg-brand-bg inline-flex items-center gap-2 w-fit px-3 sm:px-4 py-2 rounded-lg border border-brand-border">
                <span className="font-body text-[10px] sm:text-xs text-brand-text-secondary uppercase tracking-wider">From the Oven</span>
                <span className="font-heading text-lg sm:text-xl font-bold text-brand-primary">{heroProduct.price}</span>
              </div>
            </div>
            {/* Hero Image */}
            <div className="relative h-48 sm:h-64 lg:h-auto overflow-hidden">
              <img
                src={heroProduct.image}
                alt={heroProduct.title}
                data-testid="hero-image"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Curated Collections — stacked on mobile */}
      <section data-testid="curated-collections-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12">
        <h2
          data-testid="collections-heading"
          className="font-heading text-xl sm:text-2xl lg:text-3xl font-bold text-brand-text mb-5 sm:mb-8"
        >
          Curated Collections
        </h2>
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-5">
          {/* Large Card */}
          <div
            data-testid="collection-card-1"
            className="lg:col-span-2 lg:row-span-2 relative rounded-2xl overflow-hidden group cursor-pointer h-48 sm:h-72 lg:h-auto"
          >
            <img
              src={collections[0].image}
              alt={collections[0].title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6">
              <h3 className="font-heading text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1">
                {collections[0].title}
              </h3>
              <p className="font-body text-xs sm:text-sm text-white/80 mb-2 sm:mb-3 line-clamp-2">
                {collections[0].subtitle}
              </p>
              <span className="inline-flex items-center gap-1 font-body text-sm text-brand-orange font-medium">
                Explore <ArrowRight size={14} />
              </span>
            </div>
          </div>
          {/* Small Cards — row on mobile, stacked in grid column on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-5">
            {collections.slice(1).map((col) => (
              <div
                key={col.id}
                data-testid={`collection-card-${col.id}`}
                className="relative rounded-2xl overflow-hidden group cursor-pointer h-36 sm:h-48"
              >
                <img
                  src={col.image}
                  alt={col.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4">
                  <h3 className="font-heading text-sm sm:text-lg font-bold text-white">
                    {col.title}
                  </h3>
                  <p className="font-body text-[10px] sm:text-xs text-white/80 line-clamp-1">
                    {col.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Currently Craving — horizontal scroll on mobile, grid on desktop */}
      <section data-testid="craving-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 sm:pb-16">
        <div className="flex items-end justify-between mb-5 sm:mb-8">
          <div>
            <h2
              data-testid="craving-heading"
              className="font-heading text-xl sm:text-2xl lg:text-3xl font-bold text-brand-text"
            >
              Currently Craving
            </h2>
            <p className="font-body text-xs sm:text-sm text-brand-text-secondary mt-1">
              The most sought-after items in our curation.
            </p>
          </div>
          <Link
            to="/menu"
            data-testid="view-menu-link"
            className="hidden sm:inline-flex items-center gap-1 font-body text-sm font-medium text-brand-primary hover:text-brand-primary-hover transition-colors"
          >
            View Complete Menu <ArrowRight size={14} />
          </Link>
        </div>

        {/* Horizontal scroll on mobile */}
        <div className="flex gap-4 overflow-x-auto hide-scrollbar scroll-snap-x pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-6 sm:overflow-visible">
          {cravingItems.map((item, idx) => (
            <Link
              key={item.id}
              to={`/product/${item.id}`}
              data-testid={`craving-card-${item.id}`}
              className={`product-card group bg-brand-surface rounded-2xl overflow-hidden border border-brand-border flex-shrink-0 w-[160px] sm:w-auto opacity-0 animate-fade-in stagger-${idx + 1}`}
            >
              <div className="relative aspect-square overflow-hidden bg-brand-bg">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {item.liked && (
                  <button
                    data-testid={`like-btn-${item.id}`}
                    className="absolute top-2 sm:top-3 right-2 sm:right-3 w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-brand-primary flex items-center justify-center"
                  >
                    <Heart size={12} className="text-white fill-white" />
                  </button>
                )}
                {item.tag && (
                  <span className="absolute top-2 sm:top-3 right-2 sm:right-3 px-2 py-0.5 bg-brand-orange text-white text-[9px] sm:text-[10px] font-body font-semibold uppercase tracking-wider rounded">
                    {item.tag}
                  </span>
                )}
              </div>
              <div className="p-3 sm:p-4">
                <h3 className="font-heading text-sm sm:text-base font-semibold text-brand-text line-clamp-1">
                  {item.name}
                </h3>
                <p className="font-body text-[10px] sm:text-xs text-brand-text-secondary mt-0.5 line-clamp-1">
                  {item.vendor}
                </p>
                <div className="flex items-center justify-between mt-2 sm:mt-3">
                  <span className="font-heading text-base sm:text-lg font-bold text-brand-primary">
                    {item.priceLabel}
                  </span>
                  <button
                    data-testid={`add-btn-${item.id}`}
                    onClick={(e) => handleAdd(e, item)}
                    className="w-8 h-8 rounded-full border border-brand-border flex items-center justify-center hover:bg-brand-primary hover:text-white hover:border-brand-primary active:scale-90 transition-all duration-200"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="sm:hidden mt-5 text-center">
          <Link
            to="/menu"
            className="inline-flex items-center gap-1 font-body text-sm font-medium text-brand-primary"
          >
            View Complete Menu <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}
