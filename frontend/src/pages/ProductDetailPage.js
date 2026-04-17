import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Minus, Plus, ArrowLeft, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCart } from "@/contexts/CartContext";

const API_BASE = "/api";

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [modifierGroups, setModifierGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [selections, setSelections] = useState({});
  const [instructions, setInstructions] = useState("");
  const [errors, setErrors] = useState({});
  const { addItem } = useCart();

  useEffect(() => {
    const load = async () => {
      try {
        const [itemResp, modResp] = await Promise.all([
          fetch(`${API_BASE}/menu/items/${id}`),
          fetch(`${API_BASE}/menu/items/${id}/modifiers`),
        ]);
        const itemData = await itemResp.json();
        const modData = await modResp.json();
        setProduct(itemData);
        setModifierGroups(modData.groups || []);
        // Pre-select first option for required groups
        const initial = {};
        for (const g of modData.groups || []) {
          if (g.type === "required" && g.options?.length > 0) {
            initial[g.id] = [g.options[0].id];
          }
        }
        setSelections(initial);
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <div className="min-h-screen flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!product) return <div className="min-h-screen flex flex-col items-center justify-center gap-4"><p className="font-body text-sm text-brand-text-secondary">Item not found</p><Link to="/menu" className="font-body text-sm text-brand-primary">Back to Menu</Link></div>;

  const images = product.images?.length > 0 ? product.images : [product.image];
  const isSoldOut = product.status === "sold_out";
  const isSeasonal = product.status === "seasonal";

  // Calculate modifier price
  const getModifierTotal = () => {
    let total = 0;
    for (const group of modifierGroups) {
      const selected = selections[group.id] || [];
      for (const optId of selected) {
        const opt = group.options.find(o => o.id === optId);
        if (opt) total += opt.price_adjustment || 0;
      }
    }
    return total;
  };

  const modifierTotal = getModifierTotal();
  const unitPrice = product.price + modifierTotal;
  const total = unitPrice * qty;

  // Selection handlers
  const handleRequiredSelect = (groupId, optionId) => {
    setSelections(prev => ({ ...prev, [groupId]: [optionId] }));
    setErrors(prev => ({ ...prev, [groupId]: undefined }));
  };

  const handleOptionalToggle = (groupId, optionId, maxSel) => {
    setSelections(prev => {
      const current = prev[groupId] || [];
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter(id => id !== optionId) };
      }
      if (maxSel > 0 && current.length >= maxSel) return prev;
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  // Validation
  const validate = () => {
    const newErrors = {};
    for (const group of modifierGroups) {
      if (group.type === "required") {
        const selected = selections[group.id] || [];
        if (selected.length < (group.min_selections || 1)) {
          newErrors[group.id] = `Please select ${group.min_selections || 1} option`;
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddToOrder = () => {
    if (isSoldOut) return;
    if (!validate()) return;

    const modifiers = [];
    for (const group of modifierGroups) {
      const selected = selections[group.id] || [];
      for (const optId of selected) {
        const opt = group.options.find(o => o.id === optId);
        if (opt) modifiers.push({ group: group.name, name: opt.name, price: opt.price_adjustment || 0 });
      }
    }

    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      modifiers,
      instructions,
      qty,
    });
    setQty(1);
  };

  const prevImg = () => setActiveImg(p => (p === 0 ? images.length - 1 : p - 1));
  const nextImg = () => setActiveImg(p => (p === images.length - 1 ? 0 : p + 1));

  const statusBadge = () => {
    if (isSoldOut) return <span data-testid="status-badge" className="px-3 py-1 bg-red-600 text-white text-[10px] font-body font-bold uppercase tracking-wider rounded">Sold Out</span>;
    if (isSeasonal) return <span data-testid="status-badge" className="px-3 py-1 bg-amber-500 text-white text-[10px] font-body font-bold uppercase tracking-wider rounded">Seasonal</span>;
    return <span data-testid="status-badge" className="px-3 py-1 bg-green-600 text-white text-[10px] font-body font-bold uppercase tracking-wider rounded">In Stock</span>;
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div data-testid="product-detail-page" className={`min-h-screen ${isSoldOut ? "" : "pb-24 sm:pb-0"}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <Link to="/menu" data-testid="back-to-menu-btn" className="inline-flex items-center gap-2 font-body text-sm text-brand-text-secondary hover:text-brand-text transition-colors mb-4 sm:mb-6">
          <ArrowLeft size={16} /> Back to Menu
        </Link>

        {/* Gallery */}
        <div data-testid="product-gallery" className="relative rounded-xl sm:rounded-2xl overflow-hidden mb-5 sm:mb-8 aspect-[4/3] sm:aspect-[16/8] bg-brand-bg">
          <img src={images[activeImg]} alt={product.name} data-testid="product-image" className={`w-full h-full object-cover transition-opacity duration-300 ${isSoldOut ? "grayscale opacity-60" : ""}`} />
          {isSoldOut && <div className="absolute inset-0 flex items-center justify-center"><span className="px-6 py-2 bg-red-600/90 text-white text-sm font-body font-bold uppercase tracking-wider rounded-lg">Sold Out</span></div>}
          {images.length > 1 && (
            <>
              <button data-testid="gallery-prev" onClick={prevImg} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-brand-surface/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md"><ChevronLeft size={18} /></button>
              <button data-testid="gallery-next" onClick={nextImg} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-brand-surface/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md"><ChevronRight size={18} /></button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, idx) => <button key={idx} onClick={() => setActiveImg(idx)} className={`w-2 h-2 rounded-full transition-all ${idx === activeImg ? "bg-white w-5" : "bg-white/50"}`} />)}
              </div>
            </>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar">
            {images.map((url, idx) => <button key={idx} onClick={() => setActiveImg(idx)} className={`w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${idx === activeImg ? "border-brand-primary" : "border-transparent opacity-60 hover:opacity-100"}`}><img src={url} alt="" className="w-full h-full object-cover" /></button>)}
          </div>
        )}

        {/* Status + Tags */}
        <div data-testid="product-tags" className="flex flex-wrap items-center gap-2 mb-3">{statusBadge()}{product.tags?.map(tag => <span key={tag} className={`px-2.5 py-1 text-[10px] font-body font-semibold uppercase tracking-wider rounded ${tag.includes("SIGNATURE") || tag.includes("SELECTION") ? "bg-brand-orange text-white" : "bg-brand-bg text-brand-text-secondary border border-brand-border"}`}>{tag}</span>)}</div>

        <h1 data-testid="product-name" className={`font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight ${isSoldOut ? "text-brand-text-secondary" : "text-brand-text"}`}>{product.name}</h1>

        {/* Live price */}
        <div className="flex items-baseline gap-2 mt-1">
          <span data-testid="product-price" className={`font-heading text-xl sm:text-2xl font-bold ${isSoldOut ? "text-brand-text-secondary" : "text-brand-primary"}`}>
            ${unitPrice.toFixed(2)}
          </span>
          {modifierTotal > 0 && (
            <span data-testid="modifier-price-adjustment" className="font-body text-xs text-brand-text-secondary">(base ${product.price.toFixed(2)} + ${modifierTotal.toFixed(2)} modifiers)</span>
          )}
        </div>

        <p data-testid="product-description" className="font-body text-sm text-brand-text-secondary mt-4 leading-relaxed max-w-2xl">{product.description}</p>

        {isSoldOut && (
          <div data-testid="sold-out-message" className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="font-body text-sm text-red-700 font-medium">This item is currently unavailable.</p>
            <p className="font-body text-xs text-red-500 mt-1">Check back soon or explore our other offerings.</p>
          </div>
        )}

        {/* Modifier Groups */}
        {!isSoldOut && modifierGroups.length > 0 && (
          <div data-testid="modifier-groups" className="mt-7 sm:mt-10 space-y-6">
            {modifierGroups.map((group) => {
              const isRequired = group.type === "required";
              const selected = selections[group.id] || [];
              const hasError = errors[group.id];
              return (
                <div key={group.id} data-testid={`modifier-group-${group.id}`} className={`bg-brand-surface border rounded-xl overflow-hidden ${hasError ? "border-red-400" : "border-brand-border"}`}>
                  {/* Group header */}
                  <div className={`px-4 py-3 flex items-center justify-between ${hasError ? "bg-red-50" : "bg-brand-bg/50"}`}>
                    <div className="flex items-center gap-2">
                      <h2 className="font-heading text-base sm:text-lg font-bold text-brand-text">{group.name}</h2>
                      {isRequired && (
                        <span data-testid={`required-badge-${group.id}`} className="px-2 py-0.5 bg-brand-primary text-white text-[9px] font-body font-bold uppercase tracking-wider rounded">Required</span>
                      )}
                    </div>
                    <span className="font-body text-[10px] text-brand-text-secondary">
                      {isRequired ? `Select ${group.min_selections || 1}` : group.max_selections > 0 ? `Up to ${group.max_selections}` : "Optional"}
                    </span>
                  </div>

                  {/* Error */}
                  {hasError && (
                    <div data-testid={`modifier-error-${group.id}`} className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2">
                      <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                      <span className="font-body text-xs text-red-600">{hasError}</span>
                    </div>
                  )}

                  {/* Options */}
                  <div className="divide-y divide-brand-border">
                    {isRequired ? (
                      <RadioGroup value={selected[0] || ""} onValueChange={(val) => handleRequiredSelect(group.id, val)}>
                        {group.options.map((opt) => (
                          <label key={opt.id} data-testid={`modifier-opt-${opt.id}`} className="flex items-center justify-between p-4 cursor-pointer hover:bg-brand-bg/50 active:bg-brand-bg transition-colors">
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value={opt.id} id={opt.id} />
                              <span className="font-body text-sm font-medium text-brand-text">{opt.name}</span>
                            </div>
                            <span className={`font-heading text-sm font-semibold ${opt.price_adjustment > 0 ? "text-brand-primary" : "text-brand-text-secondary"}`}>
                              {opt.price_adjustment > 0 ? `+$${opt.price_adjustment.toFixed(2)}` : opt.price_adjustment < 0 ? `-$${Math.abs(opt.price_adjustment).toFixed(2)}` : "Included"}
                            </span>
                          </label>
                        ))}
                      </RadioGroup>
                    ) : (
                      group.options.map((opt) => {
                        const isChecked = selected.includes(opt.id);
                        const atMax = group.max_selections > 0 && selected.length >= group.max_selections && !isChecked;
                        return (
                          <label key={opt.id} data-testid={`modifier-opt-${opt.id}`} className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${atMax ? "opacity-40" : "hover:bg-brand-bg/50 active:bg-brand-bg"}`}>
                            <div className="flex items-center gap-3">
                              <Checkbox checked={isChecked} onCheckedChange={() => handleOptionalToggle(group.id, opt.id, group.max_selections)} disabled={atMax} className="w-5 h-5 sm:w-4 sm:h-4" />
                              <span className="font-body text-sm font-medium text-brand-text">{opt.name}</span>
                            </div>
                            <span className={`font-heading text-sm font-semibold ${opt.price_adjustment > 0 ? "text-brand-primary" : "text-brand-text-secondary"}`}>
                              {opt.price_adjustment > 0 ? `+$${opt.price_adjustment.toFixed(2)}` : "Free"}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Special Instructions */}
        {!isSoldOut && (
          <div data-testid="special-instructions-section" className="mt-6 sm:mt-8 mb-6 sm:mb-12">
            <h2 className="font-heading text-lg sm:text-xl font-bold text-brand-text mb-3">Special Instructions</h2>
            <Textarea data-testid="special-instructions-input" placeholder="Any dietary requirements or preparation requests?" value={instructions} onChange={(e) => setInstructions(e.target.value)} className="bg-brand-bg border-brand-border font-body text-sm resize-none min-h-[80px] sm:min-h-[100px] placeholder:text-brand-text-secondary/60" />
          </div>
        )}

        {/* Desktop Add to Order */}
        {!isSoldOut && (
          <div data-testid="product-actions" className="hidden sm:flex items-center gap-4 mt-6 mb-8">
            <div className="inline-flex items-center border border-brand-border rounded-full overflow-hidden">
              <button data-testid="qty-decrease-btn" onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-brand-text hover:bg-brand-bg transition-colors"><Minus size={16} /></button>
              <span data-testid="qty-display" className="w-8 text-center font-body text-sm font-medium text-brand-text">{qty}</span>
              <button data-testid="qty-increase-btn" onClick={() => setQty(q => q + 1)} className="w-10 h-10 flex items-center justify-center text-brand-text hover:bg-brand-bg transition-colors"><Plus size={16} /></button>
            </div>
            <button data-testid="add-to-order-btn" onClick={handleAddToOrder} className={`flex-1 flex items-center justify-between px-6 py-3 text-white font-body text-sm font-semibold rounded-full transition-colors duration-200 ${hasErrors ? "bg-red-500 hover:bg-red-600" : "bg-brand-primary hover:bg-brand-primary-hover"}`}>
              <span>{hasErrors ? "Complete required selections" : "Add to Order"}</span>
              <span>${total.toFixed(2)}</span>
            </button>
          </div>
        )}
      </div>

      {/* Mobile sticky bar */}
      {!isSoldOut && (
        <div data-testid="mobile-add-bar" className="sm:hidden fixed bottom-16 left-0 right-0 z-40 bg-brand-surface/95 backdrop-blur-md border-t border-brand-border px-4 py-3 safe-area-bottom">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center border border-brand-border rounded-full overflow-hidden">
              <button data-testid="mobile-qty-decrease-btn" onClick={() => setQty(q => Math.max(1, q - 1))} className="w-11 h-11 flex items-center justify-center text-brand-text active:bg-brand-bg"><Minus size={18} /></button>
              <span data-testid="mobile-qty-display" className="w-8 text-center font-body text-sm font-semibold">{qty}</span>
              <button data-testid="mobile-qty-increase-btn" onClick={() => setQty(q => q + 1)} className="w-11 h-11 flex items-center justify-center text-brand-text active:bg-brand-bg"><Plus size={18} /></button>
            </div>
            <button data-testid="mobile-add-to-order-btn" onClick={handleAddToOrder} className={`flex-1 flex items-center justify-between px-5 py-3.5 text-white font-body text-sm font-semibold rounded-full active:scale-[0.97] transition-all ${hasErrors ? "bg-red-500" : "bg-brand-primary"}`}>
              <span>{hasErrors ? "Complete selections" : "Add to Order"}</span>
              <span>${total.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
