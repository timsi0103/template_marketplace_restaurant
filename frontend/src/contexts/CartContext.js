import { createContext, useContext, useState, useCallback, useRef } from "react";
import { toast } from "sonner";

const CartContext = createContext(null);
const CART_KEY = "culinary_cart";
const MIN_ORDER_AMOUNT = 15;

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

let lineCounter = Date.now();

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const undoRef = useRef(null);

  const addItem = useCallback((product) => {
    const modifiers = product.modifiers || [];
    const variant = product.variant || null;
    const modKey = modifiers.map(m => `${m.group}:${m.name}`).sort().join("|");
    const varKey = variant ? `var:${variant.id}` : "";
    const fullKey = [varKey, modKey].filter(Boolean).join("||");
    const instructions = product.instructions || "";

    setItems((prev) => {
      const existing = prev.find(
        (i) => i.id === product.id && (i.fullKey || "") === fullKey && (i.instructions || "") === instructions
      );
      let next;
      if (existing) {
        next = prev.map((i) =>
          i.cartLineId === existing.cartLineId ? { ...i, qty: i.qty + (product.qty || 1) } : i
        );
      } else {
        const modTotal = modifiers.reduce((s, m) => s + (m.price || 0), 0);
        const variantPrice = variant ? variant.price : product.price;
        next = [
          ...prev,
          {
            cartLineId: `line_${++lineCounter}`,
            id: product.id,
            name: product.name,
            basePrice: product.price,
            price: variantPrice + modTotal,
            image: product.image,
            modifiers,
            variant,
            modKey,
            fullKey,
            instructions,
            qty: product.qty || 1,
          },
        ];
      }
      saveCart(next);
      return next;
    });
    setDrawerOpen(true);
  }, []);

  const removeItem = useCallback((cartLineId) => {
    setItems((prev) => {
      const removed = prev.find((i) => i.cartLineId === cartLineId);
      const next = prev.filter((i) => i.cartLineId !== cartLineId);
      saveCart(next);

      // Undo toast
      if (removed) {
        if (undoRef.current) toast.dismiss(undoRef.current);
        undoRef.current = toast(`${removed.name} removed`, {
          description: removed.variant ? `${removed.variant.name} — $${removed.price.toFixed(2)}` : `$${removed.price.toFixed(2)}`,
          action: {
            label: "Undo",
            onClick: () => {
              setItems((curr) => {
                const restored = [...curr, removed];
                saveCart(restored);
                return restored;
              });
            },
          },
          duration: 4000,
        });
      }
      return next;
    });
  }, []);

  const updateQty = useCallback((cartLineId, qty) => {
    if (qty <= 0) {
      removeItem(cartLineId);
      return;
    }
    setItems((prev) => {
      const next = prev.map((i) => (i.cartLineId === cartLineId ? { ...i, qty } : i));
      saveCart(next);
      return next;
    });
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
    saveCart([]);
  }, []);

  const itemCount = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const belowMinimum = subtotal > 0 && subtotal < MIN_ORDER_AMOUNT;
  const amountToMinimum = MIN_ORDER_AMOUNT - subtotal;

  return (
    <CartContext.Provider
      value={{ items, itemCount, subtotal, addItem, removeItem, updateQty, clearCart, drawerOpen, setDrawerOpen, belowMinimum, amountToMinimum, MIN_ORDER_AMOUNT }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
