import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Minus, Plus, Loader2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useCart } from "@/contexts/CartContext";

const API = "/api";

/** Lightweight item preview — image, price, variant + required modifiers, Add to cart. */
export default function QuickViewModal({ itemId, open, onClose }) {
  const { addItem } = useCart();
  const [item, setItem] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [qty, setQty] = useState(1);
  const [variant, setVariant] = useState(null);
  const [selections, setSelections] = useState({});

  useEffect(() => {
    if (!open || !itemId) return;
    setLoading(true); setItem(null); setGroups([]); setSelections({}); setVariant(null); setQty(1);
    Promise.all([
      axios.get(`${API}/menu/items/${itemId}`),
      axios.get(`${API}/menu/items/${itemId}/modifiers`),
    ]).then(([i, m]) => {
      setItem(i.data); setGroups(m.data?.groups || []);
      const vs = i.data?.variants || [];
      if (vs.length) setVariant((vs.find((v) => v.status !== "sold_out") || vs[0]).id);
      const initial = {};
      for (const g of m.data?.groups || []) {
        if (g.type === "required" && g.options?.length) initial[g.id] = [g.options[0].id];
      }
      setSelections(initial);
    }).catch(() => setItem(null)).finally(() => setLoading(false));
  }, [itemId, open]);

  if (!open) return null;

  const variants = item?.variants || [];
  const activeVariant = variants.find((v) => v.id === variant) || null;
  const isSoldOut = activeVariant ? activeVariant.status === "sold_out" : item?.status === "sold_out";
  const basePrice = activeVariant ? activeVariant.price : item?.price || 0;
  const modTotal = groups.reduce((sum, g) => {
    const sel = selections[g.id] || [];
    return sum + sel.reduce((s, id) => s + ((g.options.find((o) => o.id === id)?.price_adjustment) || 0), 0);
  }, 0);
  const total = (basePrice + modTotal) * qty;

  const pickRequired = (gid, oid) => setSelections((p) => ({ ...p, [gid]: [oid] }));
  const toggleOpt = (gid, oid, maxSel) => setSelections((p) => {
    const cur = p[gid] || [];
    if (cur.includes(oid)) return { ...p, [gid]: cur.filter((x) => x !== oid) };
    if (maxSel > 0 && cur.length >= maxSel) return p;
    return { ...p, [gid]: [...cur, oid] };
  });

  const onAdd = () => {
    if (!item || isSoldOut) return;
    for (const g of groups) {
      if (g.type === "required" && (selections[g.id] || []).length < (g.min_selections || 1)) return;
    }
    const modifiers = [];
    for (const g of groups) {
      for (const oid of selections[g.id] || []) {
        const o = g.options.find((o) => o.id === oid);
        if (o) modifiers.push({ group: g.name, name: o.name, price: o.price_adjustment || 0 });
      }
    }
    for (let i = 0; i < qty; i++) {
      addItem({
        id: item.id, name: item.name, price: basePrice, image: item.image,
        modifiers,
        variant: activeVariant ? { id: activeVariant.id, name: activeVariant.name, price: activeVariant.price } : null,
      });
    }
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent data-testid="quick-view-modal" className="max-w-3xl p-0 overflow-hidden gap-0 max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">{item?.name || "Item preview"}</DialogTitle>
        <DialogDescription className="sr-only">Item details with variants, modifiers, and add-to-cart.</DialogDescription>
        {loading || !item ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-brand-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2">
            <div className="relative bg-brand-bg">
              <img src={item.image} alt={item.name} className="w-full h-56 sm:h-full sm:min-h-[22rem] object-cover" />
              {isSoldOut && <span className="absolute top-3 left-3 px-2.5 py-1 bg-red-600 text-white text-[10px] font-body font-bold uppercase rounded">Sold Out</span>}
              {item.dietary_tags?.length > 0 && (
                <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
                  {item.dietary_tags.slice(0, 4).map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-body font-semibold bg-white/95 text-brand-text capitalize">
                      {t.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="p-5 sm:p-6 flex flex-col">
              <h2 data-testid="quickview-title" className="font-heading text-2xl font-bold text-brand-text leading-tight">{item.name}</h2>
              <p className="font-body text-xs text-brand-text-secondary mt-1.5 leading-relaxed line-clamp-3">{item.description}</p>
              <div className="flex items-baseline gap-1 mt-3">
                <span className="font-heading text-2xl font-bold text-brand-primary">${basePrice.toFixed(2)}</span>
                {modTotal > 0 && <span className="font-body text-xs text-brand-text-secondary">+ ${modTotal.toFixed(2)} mods</span>}
              </div>

              {variants.length > 0 && (
                <div className="mt-4">
                  <div className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold mb-1.5">Size</div>
                  <div className="flex flex-wrap gap-1.5">
                    {variants.map((v) => {
                      const out = v.status === "sold_out";
                      const active = variant === v.id;
                      return (
                        <button
                          key={v.id} data-testid={`quickview-variant-${v.id}`}
                          disabled={out} onClick={() => setVariant(v.id)}
                          className={`px-3 py-1.5 rounded-full border text-xs font-body font-medium transition ${out ? "border-brand-border text-brand-text-secondary/50 line-through cursor-not-allowed" : active ? "bg-brand-primary text-white border-brand-primary" : "border-brand-border text-brand-text hover:border-brand-primary/50"}`}
                        >
                          {v.name} · ${v.price.toFixed(0)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {groups.length > 0 && (
                <div className="mt-4 space-y-3 max-h-52 overflow-y-auto pr-1">
                  {groups.map((g) => {
                    const sel = selections[g.id] || [];
                    return (
                      <div key={g.id} data-testid={`quickview-group-${g.id}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">{g.name}</div>
                          <span className="text-[10px] text-brand-text-secondary">{g.type === "required" ? "Required" : `Pick up to ${g.max_selections || "any"}`}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {g.options.map((o) => {
                            const active = sel.includes(o.id);
                            return (
                              <button
                                key={o.id}
                                onClick={() => g.type === "required" ? pickRequired(g.id, o.id) : toggleOpt(g.id, o.id, g.max_selections || 0)}
                                className={`px-2.5 py-1 rounded-full border text-[11px] font-body font-medium transition ${active ? "bg-brand-orange text-white border-brand-orange" : "border-brand-border text-brand-text hover:border-brand-orange/50"}`}
                              >
                                {o.name}{o.price_adjustment ? ` +$${o.price_adjustment.toFixed(2)}` : ""}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-auto pt-5 flex items-center gap-3 border-t border-brand-border mt-5">
                <div className="flex items-center border border-brand-border rounded-full">
                  <button data-testid="quickview-qty-minus" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-8 flex items-center justify-center text-brand-text-secondary hover:text-brand-primary"><Minus size={14} /></button>
                  <span data-testid="quickview-qty" className="w-6 text-center text-sm font-body font-semibold">{qty}</span>
                  <button data-testid="quickview-qty-plus" onClick={() => setQty((q) => q + 1)} className="w-8 h-8 flex items-center justify-center text-brand-text-secondary hover:text-brand-primary"><Plus size={14} /></button>
                </div>
                <button
                  data-testid="quickview-add-btn"
                  onClick={onAdd}
                  disabled={isSoldOut}
                  className="flex-1 px-4 py-2.5 rounded-full bg-brand-primary text-white font-body text-sm font-semibold hover:bg-brand-primary-hover disabled:bg-brand-border disabled:text-brand-text-secondary active:scale-[0.98] transition"
                >
                  {isSoldOut ? "Sold out" : `Add · $${total.toFixed(2)}`}
                </button>
              </div>
              <Link
                to={`/product/${item.id}`}
                onClick={() => onClose?.()}
                data-testid="quickview-details-link"
                className="mt-3 inline-flex items-center justify-center gap-1 font-body text-xs text-brand-primary hover:underline"
              >
                Full details <ExternalLink size={12} />
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
