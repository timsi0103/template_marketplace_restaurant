import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ArrowRight, ShoppingBag, AlertCircle, Tag, CheckCircle2, X, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";

export default function CartDrawer() {
  const {
    items, itemCount, subtotal, updateQty, removeItem,
    drawerOpen, setDrawerOpen, belowMinimum, amountToMinimum, MIN_ORDER_AMOUNT,
    promo, applyPromoCode, clearPromo,
  } = useCart();
  const navigate = useNavigate();
  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [availableCoupons, setAvailableCoupons] = useState([]);

  // Pull live coupons whenever the drawer opens or the subtotal changes
  useEffect(() => {
    if (!drawerOpen || items.length === 0) return;
    fetch(`/api/coupons/active?subtotal=${subtotal || 0}`)
      .then((r) => r.json())
      .then((d) => setAvailableCoupons(d.coupons || []))
      .catch(() => setAvailableCoupons([]));
  }, [drawerOpen, subtotal, items.length]);

  // Compute preview discount for sidebar (delivery discount not reflected here since fulfillment isn't selected yet)
  const discount = (() => {
    if (!promo?.rule) return 0;
    if (promo.rule.type === "percent") return +(subtotal * (promo.rule.value / 100)).toFixed(2);
    if (promo.rule.type === "fixed") return Math.min(subtotal, +promo.rule.value.toFixed(2));
    // free_delivery reflects at checkout (cart doesn't have fulfillment yet)
    return 0;
  })();
  const afterDiscount = Math.max(0, subtotal - discount);

  const onApplyPromo = async (codeArg) => {
    const code = (typeof codeArg === "string" ? codeArg : promoInput).trim();
    if (!code || promoLoading) return;
    setPromoLoading(true);
    setPromoError("");
    const res = await applyPromoCode(code);
    setPromoLoading(false);
    if (res.ok) {
      toast.success("Promo applied", { description: res.rule?.description });
      setPromoInput("");
    } else {
      setPromoError(res.error || "Invalid code");
      toast.error(res.error || "Invalid promo code");
    }
  };

  const handleCheckout = () => {
    if (belowMinimum) return;
    setDrawerOpen(false);
    navigate("/checkout");
  };

  const handleBrowseMenu = () => {
    setDrawerOpen(false);
    navigate("/menu");
  };

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent
        side="right"
        data-testid="cart-sidebar"
        className="bg-brand-surface border-l border-brand-border p-0 w-full sm:max-w-md flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-brand-border text-left">
          <SheetTitle className="font-heading text-xl font-bold text-brand-text flex items-center gap-2">
            <ShoppingBag size={20} className="text-brand-primary" />
            Your Cart
            {itemCount > 0 && (
              <span
                data-testid="cart-item-count-badge"
                className="ml-1 px-2 py-0.5 text-[10px] font-body font-semibold bg-brand-primary text-white rounded-full"
              >
                {itemCount}
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="font-body text-xs text-brand-text-secondary">
            {itemCount === 0
              ? "Your cart is empty. Start adding items!"
              : `${itemCount} item${itemCount > 1 ? "s" : ""} in your cart`}
          </SheetDescription>
        </SheetHeader>

        {/* Minimum order banner */}
        {belowMinimum && (
          <div
            data-testid="cart-min-order-banner"
            className="mx-5 mt-3 flex items-start gap-2 rounded-lg border border-brand-orange/30 bg-brand-orange/10 px-3 py-2.5"
          >
            <AlertCircle size={16} className="text-brand-orange flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-body text-xs font-semibold text-brand-text">
                Add ${amountToMinimum.toFixed(2)} more to reach the ${MIN_ORDER_AMOUNT} minimum
              </p>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-brand-border">
                <div
                  data-testid="cart-min-order-progress"
                  className="h-full rounded-full bg-brand-orange transition-all duration-300"
                  style={{ width: `${Math.min(100, (subtotal / MIN_ORDER_AMOUNT) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="px-5 overflow-y-auto flex-1">
          {items.length === 0 ? (
            <div data-testid="cart-empty" className="py-16 text-center flex flex-col items-center justify-center h-full">
              <div className="w-20 h-20 rounded-full bg-brand-bg flex items-center justify-center mb-4">
                <ShoppingBag size={36} className="text-brand-border" />
              </div>
              <h3 className="font-heading text-base font-bold text-brand-text mb-1">Your cart is empty</h3>
              <p className="font-body text-sm text-brand-text-secondary mb-5 max-w-[240px]">
                Browse our menu to add delicious items to your order
              </p>
              <button
                data-testid="cart-browse-menu-btn"
                onClick={handleBrowseMenu}
                className="px-5 py-2.5 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover active:scale-[0.98] transition-all"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {items.map((item) => (
                <div
                  key={item.cartLineId}
                  data-testid={`cart-item-${item.cartLineId}`}
                  className="flex gap-3 items-start pb-4 border-b border-brand-border last:border-b-0"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-heading text-sm font-bold text-brand-text truncate">{item.name}</h4>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          data-testid={`cart-edit-${item.cartLineId}`}
                          onClick={() => {
                            setDrawerOpen(false);
                            navigate(`/product/${item.id}?editLine=${item.cartLineId}`);
                          }}
                          className="w-7 h-7 flex items-center justify-center text-brand-text-secondary hover:text-brand-primary transition-colors"
                          aria-label="Edit item"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          data-testid={`cart-remove-${item.cartLineId}`}
                          onClick={() => removeItem(item.cartLineId)}
                          className="w-7 h-7 flex items-center justify-center text-brand-text-secondary hover:text-red-500 transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Variant */}
                    {item.variant && (
                      <div data-testid={`cart-variant-${item.cartLineId}`} className="mt-0.5">
                        <span className="font-body text-[10px] text-brand-primary font-semibold">
                          {item.variant.name}
                        </span>
                      </div>
                    )}

                    {/* Modifiers */}
                    {item.modifiers?.length > 0 && (
                      <div data-testid={`cart-modifiers-${item.cartLineId}`} className="mt-1 space-y-0.5">
                        {item.modifiers.map((mod, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="font-body text-[10px] text-brand-text-secondary">
                              {mod.group}: {mod.name}
                            </span>
                            {mod.price > 0 && (
                              <span className="font-body text-[10px] text-brand-orange font-medium">
                                +${mod.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Instructions */}
                    {item.instructions && (
                      <p
                        data-testid={`cart-instructions-${item.cartLineId}`}
                        className="font-body text-[10px] text-brand-text-secondary italic mt-0.5 truncate"
                      >
                        Note: {item.instructions}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <div className="inline-flex items-center border border-brand-border rounded-full">
                        <button
                          data-testid={`cart-qty-minus-${item.cartLineId}`}
                          onClick={() => updateQty(item.cartLineId, item.qty - 1)}
                          className="w-8 h-8 flex items-center justify-center text-brand-text active:bg-brand-bg rounded-l-full transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>
                        <span
                          data-testid={`cart-qty-val-${item.cartLineId}`}
                          className="w-7 text-center font-body text-xs font-medium"
                        >
                          {item.qty}
                        </span>
                        <button
                          data-testid={`cart-qty-plus-${item.cartLineId}`}
                          onClick={() => updateQty(item.cartLineId, item.qty + 1)}
                          className="w-8 h-8 flex items-center justify-center text-brand-text active:bg-brand-bg rounded-r-full transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <p
                        data-testid={`cart-line-total-${item.cartLineId}`}
                        className="font-heading text-sm font-semibold text-brand-primary"
                      >
                        ${(item.price * item.qty).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <SheetFooter className="px-5 pb-20 sm:pb-16 pt-4 border-t border-brand-border flex-col sm:flex-col sm:space-x-0 gap-3">
            {/* Promo */}
            <div className="w-full">
              {promo ? (
                <div data-testid="cart-promo-applied" className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-green-300 bg-green-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-body text-xs font-semibold text-green-800 truncate">{promo.code}</div>
                      <div className="font-body text-[10px] text-green-700 truncate">{promo.rule?.description}</div>
                    </div>
                  </div>
                  <button
                    data-testid="cart-promo-clear-btn"
                    onClick={() => { clearPromo(); setPromoInput(""); setPromoError(""); }}
                    className="p-1 rounded-full text-green-700 hover:bg-green-100 transition"
                    aria-label="Remove promo"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Tag size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
                      <input
                        data-testid="cart-promo-input"
                        value={promoInput}
                        onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); if (promoError) setPromoError(""); }}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") { e.preventDefault(); await onApplyPromo(); }
                        }}
                        placeholder="Promo code"
                        disabled={promoLoading}
                        className={`w-full pl-7 pr-7 py-2 rounded-lg border bg-brand-bg font-mono tracking-wider text-xs uppercase h-9 focus:outline-none focus:ring-1 focus:ring-brand-primary ${promoError ? "border-red-400" : "border-brand-border"}`}
                      />
                      {promoLoading && <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-brand-primary" />}
                    </div>
                    <button
                      data-testid="cart-promo-apply-btn"
                      onClick={onApplyPromo}
                      disabled={promoLoading || !promoInput.trim()}
                      className="px-3 py-2 h-9 bg-brand-text text-white font-body text-xs font-medium rounded-lg hover:bg-brand-text/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Apply
                    </button>
                  </div>
                  {promoError && <p data-testid="cart-promo-error" className="text-[11px] text-red-600 font-body">{promoError}</p>}

                  {availableCoupons.length > 0 && (
                    <div data-testid="cart-available-coupons" className="pt-2">
                      <div className="text-[10px] uppercase tracking-widest text-brand-text-secondary font-semibold mb-1.5">Available coupons</div>
                      <div className="flex flex-wrap gap-1.5">
                        {availableCoupons.map((c) => {
                          const valueLabel = c.type === "percent" ? `${c.value}% off`
                            : c.type === "fixed" ? `$${c.value.toFixed(2)} off`
                            : "Free delivery";
                          const disabled = !c.applies_now || promoLoading;
                          return (
                            <button
                              key={c.code}
                              type="button"
                              data-testid={`cart-coupon-${c.code}`}
                              disabled={disabled}
                              onClick={() => onApplyPromo(c.code)}
                              title={c.description + (c.applies_now ? "" : ` (Spend $${(c.min_subtotal - subtotal).toFixed(2)} more to unlock)`)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono tracking-wider font-bold transition ${disabled
                                ? "border-dashed border-brand-border text-brand-text-secondary opacity-60 cursor-not-allowed"
                                : "border-brand-primary/40 bg-brand-primary/5 text-brand-text hover:bg-brand-primary hover:text-white hover:border-brand-primary"
                              }`}
                            >
                              <Tag size={10} />
                              {c.code}
                              <span className="font-body font-semibold normal-case tracking-normal text-[10px] opacity-80">· {valueLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Discount line */}
            {promo && discount > 0 && (
              <div data-testid="cart-discount-line" className="w-full flex justify-between items-center text-sm">
                <span className="font-body text-brand-text-secondary">Discount ({promo.code})</span>
                <span className="font-body text-green-700 font-semibold">−${discount.toFixed(2)}</span>
              </div>
            )}

            <div className="w-full flex justify-between items-center">
              <span className="font-body text-sm text-brand-text-secondary">Subtotal{discount > 0 ? " (after discount)" : ""}</span>
              <span
                data-testid="cart-subtotal"
                className="font-heading text-2xl font-bold text-brand-text"
              >
                ${afterDiscount.toFixed(2)}
              </span>
            </div>
            <button
              data-testid="cart-checkout-btn"
              onClick={handleCheckout}
              disabled={belowMinimum}
              className="w-full flex items-center justify-center gap-2 py-4 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-primary"
            >
              {belowMinimum ? `$${amountToMinimum.toFixed(2)} more to checkout` : "Checkout"}
              {!belowMinimum && <ArrowRight size={16} />}
            </button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
