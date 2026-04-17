import { useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ArrowRight, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter,
} from "@/components/ui/drawer";

export default function CartDrawer() {
  const { items, itemCount, subtotal, updateQty, removeItem, drawerOpen, setDrawerOpen } = useCart();
  const navigate = useNavigate();

  const handleCheckout = () => { setDrawerOpen(false); navigate("/checkout"); };

  return (
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
      <DrawerContent data-testid="cart-drawer" className="bg-brand-surface border-brand-border max-h-[85vh]">
        <DrawerHeader className="text-left px-5 pt-4 pb-2">
          <DrawerTitle className="font-heading text-xl font-bold text-brand-text flex items-center gap-2">
            <ShoppingBag size={20} className="text-brand-primary" />
            Your Cart
            {itemCount > 0 && <span className="ml-1 px-2 py-0.5 text-[10px] font-body font-semibold bg-brand-primary text-white rounded-full">{itemCount}</span>}
          </DrawerTitle>
          <DrawerDescription className="font-body text-xs text-brand-text-secondary">
            {itemCount === 0 ? "Your cart is empty. Start adding items!" : `${itemCount} item${itemCount > 1 ? "s" : ""} in your cart`}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-5 overflow-y-auto flex-1 max-h-[45vh]">
          {items.length === 0 ? (
            <div data-testid="cart-empty" className="py-10 text-center">
              <ShoppingBag size={40} className="mx-auto text-brand-border mb-3" />
              <p className="font-body text-sm text-brand-text-secondary">Browse our menu to add delicious items</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {items.map((item) => (
                <div key={item.cartLineId} data-testid={`cart-item-${item.cartLineId}`} className="flex gap-3 items-start">
                  <img src={item.image} alt={item.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-heading text-sm font-bold text-brand-text truncate">{item.name}</h4>

                    {/* Variant */}
                    {item.variant && (
                      <div data-testid={`cart-variant-${item.cartLineId}`} className="mt-0.5">
                        <span className="font-body text-[10px] text-brand-primary font-semibold">{item.variant.name}</span>
                      </div>
                    )}

                    {/* Modifiers list */}
                    {item.modifiers?.length > 0 && (
                      <div data-testid={`cart-modifiers-${item.cartLineId}`} className="mt-1 space-y-0.5">
                        {item.modifiers.map((mod, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="font-body text-[10px] text-brand-text-secondary">
                              {mod.group}: {mod.name}
                            </span>
                            {mod.price > 0 && (
                              <span className="font-body text-[10px] text-brand-orange font-medium">+${mod.price.toFixed(2)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Instructions */}
                    {item.instructions && (
                      <p data-testid={`cart-instructions-${item.cartLineId}`} className="font-body text-[10px] text-brand-text-secondary italic mt-0.5 truncate">
                        Note: {item.instructions}
                      </p>
                    )}

                    <p className="font-heading text-sm font-semibold text-brand-primary mt-1">
                      ${(item.price * item.qty).toFixed(2)}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="inline-flex items-center border border-brand-border rounded-full">
                        <button data-testid={`cart-qty-minus-${item.cartLineId}`} onClick={() => updateQty(item.cartLineId, item.qty - 1)} className="w-8 h-8 flex items-center justify-center text-brand-text active:bg-brand-bg rounded-l-full transition-colors"><Minus size={12} /></button>
                        <span data-testid={`cart-qty-val-${item.cartLineId}`} className="w-7 text-center font-body text-xs font-medium">{item.qty}</span>
                        <button data-testid={`cart-qty-plus-${item.cartLineId}`} onClick={() => updateQty(item.cartLineId, item.qty + 1)} className="w-8 h-8 flex items-center justify-center text-brand-text active:bg-brand-bg rounded-r-full transition-colors"><Plus size={12} /></button>
                      </div>
                      <button data-testid={`cart-remove-${item.cartLineId}`} onClick={() => removeItem(item.cartLineId)} className="w-8 h-8 flex items-center justify-center text-brand-text-secondary hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <DrawerFooter className="px-5 pb-5 pt-3 border-t border-brand-border">
            <div className="flex justify-between items-center mb-3">
              <span className="font-body text-sm text-brand-text-secondary">Subtotal</span>
              <span data-testid="cart-subtotal" className="font-heading text-xl font-bold text-brand-text">${subtotal.toFixed(2)}</span>
            </div>
            <button data-testid="cart-checkout-btn" onClick={handleCheckout} className="w-full flex items-center justify-center gap-2 py-4 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover active:scale-[0.98] transition-all">
              Checkout <ArrowRight size={16} />
            </button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
