import { createContext, useContext, useState, useCallback } from "react";

const CartContext = createContext(null);
const CART_KEY = "culinary_cart";

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

  // product: { id, name, price (base), image, modifiers: [{group, name, price}], variant: {id, name, price} | null, instructions }
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
      const next = prev.filter((i) => i.cartLineId !== cartLineId);
      saveCart(next);
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

  return (
    <CartContext.Provider
      value={{ items, itemCount, subtotal, addItem, removeItem, updateQty, clearCart, drawerOpen, setDrawerOpen }}
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
