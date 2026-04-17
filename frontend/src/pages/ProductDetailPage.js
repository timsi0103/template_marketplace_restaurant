import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Minus, Plus, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/contexts/CartContext";

// Use relative URL to avoid CORS redirect issues
const API_BASE = "/api";

const defaultEnhancements = [
  { id: "e1", name: "Extra Truffle Shavings", detail: "+3g Fresh Black Truffle", price: 12 },
  { id: "e2", name: "Burrata Heart", detail: "Creamy stracciatella center", price: 8 },
];

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [selectedEnhancements, setSelectedEnhancements] = useState([]);
  const [instructions, setInstructions] = useState("");
  const { addItem } = useCart();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const resp = await fetch(`${API_BASE}/menu/items/${id}`);
        const data = await resp.json();
        setProduct(data);
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-body text-sm text-brand-text-secondary">Item not found</p>
        <Link to="/menu" className="font-body text-sm text-brand-primary">Back to Menu</Link>
      </div>
    );
  }

  const images = product.images?.length > 0 ? product.images : [product.image];
  const enhancements = defaultEnhancements;
  const isSoldOut = product.status === "sold_out";
  const isSeasonal = product.status === "seasonal";

  const enhancementTotal = selectedEnhancements.reduce((sum, eId) => {
    const e = enhancements.find((x) => x.id === eId);
    return sum + (e ? e.price : 0);
  }, 0);
  const total = (product.price + enhancementTotal) * qty;

  const toggleEnhancement = (eId) => {
    setSelectedEnhancements((prev) => prev.includes(eId) ? prev.filter((x) => x !== eId) : [...prev, eId]);
  };

  const handleAddToOrder = () => {
    if (isSoldOut) return;
    for (let i = 0; i < qty; i++) {
      addItem({ id: product.id, name: product.name, price: product.price + enhancementTotal, image: product.image });
    }
  };

  const prevImg = () => setActiveImg((p) => (p === 0 ? images.length - 1 : p - 1));
  const nextImg = () => setActiveImg((p) => (p === images.length - 1 ? 0 : p + 1));

  const statusBadge = () => {
    if (isSoldOut) return <span data-testid="status-badge" className="px-3 py-1 bg-red-600 text-white text-[10px] font-body font-bold uppercase tracking-wider rounded">Sold Out</span>;
    if (isSeasonal) return <span data-testid="status-badge" className="px-3 py-1 bg-amber-500 text-white text-[10px] font-body font-bold uppercase tracking-wider rounded">Seasonal</span>;
    return <span data-testid="status-badge" className="px-3 py-1 bg-green-600 text-white text-[10px] font-body font-bold uppercase tracking-wider rounded">In Stock</span>;
  };

  return (
    <div data-testid="product-detail-page" className={`min-h-screen ${isSoldOut ? "" : "pb-24 sm:pb-0"}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <Link to="/menu" data-testid="back-to-menu-btn" className="inline-flex items-center gap-2 font-body text-sm text-brand-text-secondary hover:text-brand-text active:text-brand-text transition-colors mb-4 sm:mb-6">
          <ArrowLeft size={16} /> Back to Menu
        </Link>

        {/* Image Gallery / Carousel */}
        <div data-testid="product-gallery" className="relative rounded-xl sm:rounded-2xl overflow-hidden mb-5 sm:mb-8 aspect-[4/3] sm:aspect-[16/8] bg-brand-bg">
          <img src={images[activeImg]} alt={product.name} data-testid="product-image" className={`w-full h-full object-cover transition-opacity duration-300 ${isSoldOut ? "grayscale opacity-60" : ""}`} />
          {isSoldOut && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="px-6 py-2 bg-red-600/90 text-white text-sm font-body font-bold uppercase tracking-wider rounded-lg">Sold Out</span>
            </div>
          )}
          {images.length > 1 && (
            <>
              <button data-testid="gallery-prev" onClick={prevImg} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-brand-surface/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-brand-surface transition-colors">
                <ChevronLeft size={18} className="text-brand-text" />
              </button>
              <button data-testid="gallery-next" onClick={nextImg} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-brand-surface/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-brand-surface transition-colors">
                <ChevronRight size={18} className="text-brand-text" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, idx) => (
                  <button key={idx} data-testid={`gallery-dot-${idx}`} onClick={() => setActiveImg(idx)} className={`w-2 h-2 rounded-full transition-all ${idx === activeImg ? "bg-white w-5" : "bg-white/50"}`} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div data-testid="thumbnail-strip" className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar">
            {images.map((url, idx) => (
              <button key={idx} data-testid={`thumbnail-${idx}`} onClick={() => setActiveImg(idx)} className={`w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${idx === activeImg ? "border-brand-primary" : "border-transparent opacity-60 hover:opacity-100"}`}>
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Status + Tags */}
        <div data-testid="product-tags" className="flex flex-wrap items-center gap-2 mb-3 sm:mb-4">
          {statusBadge()}
          {product.tags?.map((tag) => (
            <span key={tag} className={`px-2.5 sm:px-3 py-1 text-[9px] sm:text-[10px] font-body font-semibold uppercase tracking-wider rounded ${tag === "CHEF'S SIGNATURE" || tag === "CHEF'S SELECTION" ? "bg-brand-orange text-white" : "bg-brand-bg text-brand-text-secondary border border-brand-border"}`}>
              {tag}
            </span>
          ))}
        </div>

        <h1 data-testid="product-name" className={`font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight ${isSoldOut ? "text-brand-text-secondary" : "text-brand-text"}`}>
          {product.name}
        </h1>
        <p data-testid="product-price" className={`font-heading text-xl sm:text-2xl font-bold mt-1 ${isSoldOut ? "text-brand-text-secondary" : "text-brand-primary"}`}>
          ${product.price?.toFixed(2)}
        </p>

        {/* Full description */}
        <p data-testid="product-description" className="font-body text-sm text-brand-text-secondary mt-4 leading-relaxed max-w-2xl">
          {product.description}
        </p>

        {/* Quantity + Add (desktop, hidden if sold out) */}
        {!isSoldOut && (
          <div data-testid="product-actions" className="hidden sm:flex items-center gap-4 mt-6">
            <div className="inline-flex items-center border border-brand-border rounded-full overflow-hidden">
              <button data-testid="qty-decrease-btn" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-brand-text hover:bg-brand-bg transition-colors"><Minus size={16} /></button>
              <span data-testid="qty-display" className="w-8 text-center font-body text-sm font-medium text-brand-text">{qty}</span>
              <button data-testid="qty-increase-btn" onClick={() => setQty((q) => q + 1)} className="w-10 h-10 flex items-center justify-center text-brand-text hover:bg-brand-bg transition-colors"><Plus size={16} /></button>
            </div>
            <button data-testid="add-to-order-btn" onClick={handleAddToOrder} className="flex-1 flex items-center justify-between px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover transition-colors duration-200">
              <span>Add to Order</span><span>${total.toFixed(2)}</span>
            </button>
          </div>
        )}

        {isSoldOut && (
          <div data-testid="sold-out-message" className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="font-body text-sm text-red-700 font-medium">This item is currently unavailable.</p>
            <p className="font-body text-xs text-red-500 mt-1">Check back soon or explore our other offerings.</p>
          </div>
        )}

        {/* Enhancements (hidden if sold out) */}
        {!isSoldOut && (
          <div data-testid="enhancements-section" className="mt-7 sm:mt-10">
            <h2 className="font-heading text-lg sm:text-xl font-bold text-brand-text mb-3 sm:mb-4">Enhancements</h2>
            <div className="bg-brand-surface border border-brand-border rounded-xl divide-y divide-brand-border">
              {enhancements.map((enh) => (
                <label key={enh.id} data-testid={`enhancement-${enh.id}`} className="flex items-center justify-between p-4 cursor-pointer hover:bg-brand-bg/50 active:bg-brand-bg transition-colors">
                  <div className="flex items-center gap-3">
                    <Checkbox data-testid={`enhancement-checkbox-${enh.id}`} checked={selectedEnhancements.includes(enh.id)} onCheckedChange={() => toggleEnhancement(enh.id)} className="w-5 h-5 sm:w-4 sm:h-4" />
                    <div>
                      <p className="font-body text-sm font-medium text-brand-text">{enh.name}</p>
                      <p className="font-body text-xs text-brand-text-secondary">{enh.detail}</p>
                    </div>
                  </div>
                  <span className="font-heading text-sm font-semibold text-brand-primary">+${enh.price}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Special Instructions (hidden if sold out) */}
        {!isSoldOut && (
          <div data-testid="special-instructions-section" className="mt-6 sm:mt-8 mb-6 sm:mb-12">
            <h2 className="font-heading text-lg sm:text-xl font-bold text-brand-text mb-3 sm:mb-4">Special Instructions</h2>
            <Textarea data-testid="special-instructions-input" placeholder="Any dietary requirements or preparation requests?" value={instructions} onChange={(e) => setInstructions(e.target.value)} className="bg-brand-bg border-brand-border font-body text-sm resize-none min-h-[80px] sm:min-h-[100px] placeholder:text-brand-text-secondary/60" />
          </div>
        )}
      </div>

      {/* Mobile sticky bottom bar (hidden if sold out) */}
      {!isSoldOut && (
        <div data-testid="mobile-add-bar" className="sm:hidden fixed bottom-16 left-0 right-0 z-40 bg-brand-surface/95 backdrop-blur-md border-t border-brand-border px-4 py-3 safe-area-bottom">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center border border-brand-border rounded-full overflow-hidden">
              <button data-testid="mobile-qty-decrease-btn" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-11 h-11 flex items-center justify-center text-brand-text active:bg-brand-bg transition-colors"><Minus size={18} /></button>
              <span data-testid="mobile-qty-display" className="w-8 text-center font-body text-sm font-semibold text-brand-text">{qty}</span>
              <button data-testid="mobile-qty-increase-btn" onClick={() => setQty((q) => q + 1)} className="w-11 h-11 flex items-center justify-center text-brand-text active:bg-brand-bg transition-colors"><Plus size={18} /></button>
            </div>
            <button data-testid="mobile-add-to-order-btn" onClick={handleAddToOrder} className="flex-1 flex items-center justify-between px-5 py-3.5 bg-brand-primary text-white font-body text-sm font-semibold rounded-full active:scale-[0.97] transition-all cta-pulse">
              <span>Add to Order</span><span>${total.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
