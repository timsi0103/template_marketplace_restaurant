import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Minus, Plus, ArrowLeft } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { Textarea } from "../components/ui/textarea";
import { useCart } from "@/contexts/CartContext";

const productData = {
  id: 1,
  name: "Truffle Infused Tagliatelle",
  price: 34.0,
  tags: ["CHEF'S SIGNATURE", "LIMITED DAILY"],
  image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=900&h=500&fit=crop",
  enhancements: [
    { id: "e1", name: "Extra Truffle Shavings", detail: "+3g Fresh Black Truffle", price: 12 },
    { id: "e2", name: "Burrata Heart", detail: "Creamy stracciatella center", price: 8 },
  ],
};

export default function ProductDetailPage() {
  const { id } = useParams();
  const [qty, setQty] = useState(1);
  const [selectedEnhancements, setSelectedEnhancements] = useState([]);
  const [instructions, setInstructions] = useState("");
  const { addItem } = useCart();

  const product = productData;
  const enhancementTotal = selectedEnhancements.reduce((sum, eId) => {
    const e = product.enhancements.find((x) => x.id === eId);
    return sum + (e ? e.price : 0);
  }, 0);
  const total = (product.price + enhancementTotal) * qty;

  const toggleEnhancement = (eId) => {
    setSelectedEnhancements((prev) =>
      prev.includes(eId) ? prev.filter((x) => x !== eId) : [...prev, eId]
    );
  };

  const handleAddToOrder = () => {
    for (let i = 0; i < qty; i++) {
      addItem({ id: product.id, name: product.name, price: product.price + enhancementTotal, image: product.image });
    }
  };

  return (
    <div data-testid="product-detail-page" className="min-h-screen pb-24 sm:pb-0">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Back Link */}
        <Link
          to="/menu"
          data-testid="back-to-menu-btn"
          className="inline-flex items-center gap-2 font-body text-sm text-brand-text-secondary hover:text-brand-text active:text-brand-text transition-colors mb-4 sm:mb-6"
        >
          <ArrowLeft size={16} /> Back to Menu
        </Link>

        {/* Product Image */}
        <div
          data-testid="product-image-container"
          className="relative rounded-xl sm:rounded-2xl overflow-hidden mb-5 sm:mb-8 aspect-[4/3] sm:aspect-[16/8] bg-brand-bg"
        >
          <img
            src={product.image}
            alt={product.name}
            data-testid="product-image"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Tags */}
        <div data-testid="product-tags" className="flex flex-wrap gap-2 mb-3 sm:mb-4">
          {product.tags.map((tag) => (
            <span
              key={tag}
              className={`px-2.5 sm:px-3 py-1 text-[9px] sm:text-[10px] font-body font-semibold uppercase tracking-wider rounded ${
                tag === "CHEF'S SIGNATURE"
                  ? "bg-brand-orange text-white"
                  : "bg-brand-bg text-brand-text-secondary border border-brand-border"
              }`}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Title & Price */}
        <h1
          data-testid="product-name"
          className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold text-brand-text tracking-tight"
        >
          {product.name}
        </h1>
        <p
          data-testid="product-price"
          className="font-heading text-xl sm:text-2xl font-bold text-brand-primary mt-1"
        >
          ${product.price.toFixed(2)}
        </p>

        {/* Quantity + Add to Order — hidden on mobile (sticky bottom bar instead) */}
        <div data-testid="product-actions" className="hidden sm:flex items-center gap-4 mt-6">
          <div className="inline-flex items-center border border-brand-border rounded-full overflow-hidden">
            <button
              data-testid="qty-decrease-btn"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-10 h-10 flex items-center justify-center text-brand-text hover:bg-brand-bg transition-colors"
            >
              <Minus size={16} />
            </button>
            <span
              data-testid="qty-display"
              className="w-8 text-center font-body text-sm font-medium text-brand-text"
            >
              {qty}
            </span>
            <button
              data-testid="qty-increase-btn"
              onClick={() => setQty((q) => q + 1)}
              className="w-10 h-10 flex items-center justify-center text-brand-text hover:bg-brand-bg transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          <button
            data-testid="add-to-order-btn"
            onClick={handleAddToOrder}
            className="flex-1 flex items-center justify-between px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover transition-colors duration-200"
          >
            <span>Add to Order</span>
            <span>${total.toFixed(2)}</span>
          </button>
        </div>

        {/* Enhancements */}
        <div data-testid="enhancements-section" className="mt-7 sm:mt-10">
          <h2 className="font-heading text-lg sm:text-xl font-bold text-brand-text mb-3 sm:mb-4">
            Enhancements
          </h2>
          <div className="bg-brand-surface border border-brand-border rounded-xl divide-y divide-brand-border">
            {product.enhancements.map((enh) => (
              <label
                key={enh.id}
                data-testid={`enhancement-${enh.id}`}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-brand-bg/50 active:bg-brand-bg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    data-testid={`enhancement-checkbox-${enh.id}`}
                    checked={selectedEnhancements.includes(enh.id)}
                    onCheckedChange={() => toggleEnhancement(enh.id)}
                    className="w-5 h-5 sm:w-4 sm:h-4"
                  />
                  <div>
                    <p className="font-body text-sm font-medium text-brand-text">
                      {enh.name}
                    </p>
                    <p className="font-body text-xs text-brand-text-secondary">
                      {enh.detail}
                    </p>
                  </div>
                </div>
                <span className="font-heading text-sm font-semibold text-brand-primary">
                  +${enh.price}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Special Instructions */}
        <div data-testid="special-instructions-section" className="mt-6 sm:mt-8 mb-6 sm:mb-12">
          <h2 className="font-heading text-lg sm:text-xl font-bold text-brand-text mb-3 sm:mb-4">
            Special Instructions
          </h2>
          <Textarea
            data-testid="special-instructions-input"
            placeholder="Any dietary requirements or preparation requests?"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="bg-brand-bg border-brand-border font-body text-sm resize-none min-h-[80px] sm:min-h-[100px] placeholder:text-brand-text-secondary/60"
          />
        </div>
      </div>

      {/* Mobile sticky bottom bar — quantity stepper + add to order */}
      <div
        data-testid="mobile-add-bar"
        className="sm:hidden fixed bottom-16 left-0 right-0 z-40 bg-brand-surface/95 backdrop-blur-md border-t border-brand-border px-4 py-3 safe-area-bottom"
      >
        <div className="flex items-center gap-3">
          {/* Touch-optimized quantity stepper */}
          <div className="inline-flex items-center border border-brand-border rounded-full overflow-hidden">
            <button
              data-testid="mobile-qty-decrease-btn"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-11 h-11 flex items-center justify-center text-brand-text active:bg-brand-bg transition-colors"
            >
              <Minus size={18} />
            </button>
            <span
              data-testid="mobile-qty-display"
              className="w-8 text-center font-body text-sm font-semibold text-brand-text"
            >
              {qty}
            </span>
            <button
              data-testid="mobile-qty-increase-btn"
              onClick={() => setQty((q) => q + 1)}
              className="w-11 h-11 flex items-center justify-center text-brand-text active:bg-brand-bg transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>

          <button
            data-testid="mobile-add-to-order-btn"
            onClick={handleAddToOrder}
            className="flex-1 flex items-center justify-between px-5 py-3.5 bg-brand-primary text-white font-body text-sm font-semibold rounded-full active:scale-[0.97] transition-all cta-pulse"
          >
            <span>Add to Order</span>
            <span>${total.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
