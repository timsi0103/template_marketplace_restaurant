import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Package, Star, Truck, Store, Utensils, Search, Mail, ArrowRight,
  RotateCcw, ShoppingBag, CheckCircle2, Clock, AlertCircle, Loader2, X,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";

const API = "/api";

const FULFILL_META = {
  delivery: { icon: Truck, label: "Delivery", color: "text-brand-primary" },
  pickup: { icon: Store, label: "Pickup", color: "text-brand-orange" },
  dine_in: { icon: Utensils, label: "Dine-in", color: "text-green-600" },
};

const STATUS_META = {
  pending: { label: "Pending", className: "bg-brand-border/50 text-brand-text-secondary" },
  preparing: { label: "Preparing", className: "bg-amber-100 text-amber-800" },
  ready: { label: "Ready", className: "bg-blue-100 text-blue-800" },
  out_for_delivery: { label: "Out for delivery", className: "bg-blue-100 text-blue-800" },
  delivered: { label: "Delivered", className: "bg-green-100 text-green-800" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
};

export default function CustomerOrdersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isLoggedIn = !!user?.email && !user?.guest;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [emailQuery, setEmailQuery] = useState("");
  const [guestLookupDone, setGuestLookupDone] = useState(false);
  const [reorderDialog, setReorderDialog] = useState(null); // {order, warnings, availableItems}
  const [reorderLoading, setReorderLoading] = useState(false);

  const loadOrders = async (email) => {
    setLoading(true);
    try {
      const params = email ? { email } : {};
      const { data } = await axios.get(`${API}/orders`, { params, withCredentials: true });
      setOrders(data.orders || []);
    } catch {
      toast.error("Could not load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) loadOrders();
    // eslint-disable-next-line
  }, [isLoggedIn]);

  // Auto-reorder via ?reorder=<order_id>
  useEffect(() => {
    const rid = searchParams.get("reorder");
    if (rid && orders.length > 0) {
      const target = orders.find((o) => o.id === rid);
      if (target) {
        startReorder(target);
        setSearchParams({}, { replace: true });
      }
    }
    // eslint-disable-next-line
  }, [orders]);

  const submitGuestLookup = (e) => {
    e.preventDefault();
    if (!emailQuery.trim() || !/\S+@\S+\.\S+/.test(emailQuery)) {
      toast.error("Enter a valid email");
      return;
    }
    setGuestLookupDone(true);
    loadOrders(emailQuery.trim());
  };

  const toggleFavorite = async (order, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) { toast.error("Login to save favorites"); return; }
    try {
      const { data } = await axios.patch(`${API}/orders/${order.id}/favorite`, {}, { withCredentials: true });
      setOrders((list) => list.map((o) => o.id === order.id ? { ...o, starred: data.starred } : o));
      toast.success(data.starred ? "Saved to favorites" : "Removed from favorites");
    } catch {
      toast.error("Could not update favorite");
    }
  };

  const { items: cartItems, addItem, setDrawerOpen } = useCart();

  const startReorder = async (order) => {
    setReorderLoading(true);
    try {
      const { data } = await axios.get(`${API}/menu/items`);
      const currentMenu = data.items || data || [];
      const menuById = new Map(currentMenu.map((m) => [m.id, m]));
      const warnings = [];
      const availableItems = [];
      for (const it of (order.items || [])) {
        const current = menuById.get(it.item_id);
        if (!current) {
          warnings.push({ name: it.name, reason: "No longer on the menu" });
          continue;
        }
        if (current.status && current.status !== "in_stock") {
          warnings.push({ name: it.name, reason: current.status === "sold_out" ? "Sold out" : `Currently ${current.status}` });
          continue;
        }
        // Variant check
        let variant = null;
        if (it.variant_id) {
          variant = (current.variants || []).find((v) => v.id === it.variant_id);
          if (!variant) {
            warnings.push({ name: `${it.name} (${it.variant_name || "variant"})`, reason: "Variant unavailable" });
            continue;
          }
        }
        availableItems.push({
          id: current.id,
          name: current.name,
          price: variant ? variant.price : current.price,
          image: current.image,
          modifiers: (it.modifiers || []).map((m) => ({ group: m.group, name: m.name, price: m.price || 0 })),
          variant: variant ? { id: variant.id, name: variant.name, price: variant.price } : null,
          instructions: it.instructions || "",
          qty: it.qty || 1,
        });
      }
      setReorderDialog({ order, warnings, availableItems });
    } catch {
      toast.error("Could not check availability");
    } finally {
      setReorderLoading(false);
    }
  };

  const confirmReorder = () => {
    if (!reorderDialog) return;
    const { availableItems } = reorderDialog;
    if (availableItems.length === 0) {
      toast.error("Nothing available to reorder");
      setReorderDialog(null);
      return;
    }
    availableItems.forEach((it) => addItem(it));
    toast.success(`${availableItems.length} item${availableItems.length > 1 ? "s" : ""} added to cart`);
    setReorderDialog(null);
    setDrawerOpen(true);
  };

  const { favorites, regular } = useMemo(() => {
    const favs = orders.filter((o) => o.starred);
    const rest = orders.filter((o) => !o.starred);
    return { favorites: favs, regular: rest };
  }, [orders]);

  // Guest email-lookup view
  if (!isLoggedIn && !guestLookupDone) {
    return (
      <div data-testid="guest-lookup" className="min-h-screen bg-brand-bg px-4 py-12">
        <div className="max-w-md mx-auto">
          <Link to="/menu" className="inline-flex items-center gap-1.5 font-body text-xs text-brand-text-secondary hover:text-brand-primary mb-4">
            <ArrowRight size={14} className="rotate-180" /> Back to menu
          </Link>
          <h1 data-testid="guest-lookup-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text mb-2">Find your order</h1>
          <p className="font-body text-sm text-brand-text-secondary mb-6">Enter the email you used at checkout to look up your past orders.</p>
          <form onSubmit={submitGuestLookup} className="space-y-3">
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Email address</Label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
              <Input
                data-testid="guest-lookup-email"
                type="email"
                value={emailQuery}
                onChange={(e) => setEmailQuery(e.target.value)}
                placeholder="you@example.com"
                className="bg-brand-surface border-brand-border h-12 pl-9"
                required
              />
            </div>
            <button
              type="submit"
              data-testid="guest-lookup-submit"
              className="w-full px-5 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover inline-flex items-center justify-center gap-2"
            >
              <Search size={14} /> Look up orders
            </button>
          </form>
          <div className="mt-6 text-center">
            <Link to="/login" data-testid="guest-login-link" className="font-body text-xs text-brand-primary underline underline-offset-2">
              Or log in to see all your orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="customer-orders-page" className="min-h-screen bg-brand-bg pb-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 data-testid="orders-page-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">Your orders</h1>
            <p className="font-body text-sm text-brand-text-secondary mt-1">
              {isLoggedIn
                ? "All your past orders — reorder or save favorites."
                : `Looking up orders for ${emailQuery}`}
            </p>
          </div>
          {!isLoggedIn && (
            <button
              data-testid="guest-change-email-btn"
              onClick={() => { setGuestLookupDone(false); setEmailQuery(""); setOrders([]); }}
              className="px-4 py-2 border border-brand-border font-body text-xs font-medium rounded-full text-brand-text hover:bg-brand-surface transition"
            >
              Change email
            </button>
          )}
        </div>

        {loading && <div data-testid="orders-loading" className="flex justify-center py-16"><Loader2 size={32} className="text-brand-primary animate-spin" /></div>}

        {!loading && orders.length === 0 && (
          <div data-testid="orders-empty" className="bg-brand-surface border border-brand-border rounded-2xl p-10 sm:p-14 text-center">
            <div className="w-20 h-20 rounded-full bg-brand-bg border border-brand-border flex items-center justify-center mx-auto mb-4">
              <ShoppingBag size={32} className="text-brand-text-secondary" />
            </div>
            <h2 className="font-heading text-2xl font-bold text-brand-text mb-1">No orders yet</h2>
            <p className="font-body text-sm text-brand-text-secondary max-w-md mx-auto mb-6">
              {isLoggedIn
                ? "Your first order is just a few taps away. Explore our menu and treat yourself."
                : "We couldn't find any orders for that email. Check for typos, or log in to see all your orders."}
            </p>
            <Link
              to="/menu"
              data-testid="orders-empty-browse-btn"
              className="inline-flex items-center gap-1.5 px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover"
            >
              Browse menu <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {!loading && favorites.length > 0 && (
          <section data-testid="favorites-section" className="mb-8">
            <h2 className="font-heading text-base font-bold text-brand-text mb-3 inline-flex items-center gap-2">
              <Star size={14} className="fill-amber-400 text-amber-400" /> Favorites
            </h2>
            <div className="space-y-3">
              {favorites.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  onReorder={() => startReorder(o)}
                  onToggleFavorite={(e) => toggleFavorite(o, e)}
                  showFavoriteToggle={isLoggedIn}
                  reorderLoading={reorderLoading}
                />
              ))}
            </div>
          </section>
        )}

        {!loading && regular.length > 0 && (
          <section data-testid="history-section">
            {favorites.length > 0 && (
              <h2 className="font-heading text-base font-bold text-brand-text mb-3">All orders</h2>
            )}
            <div className="space-y-3">
              {regular.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  onReorder={() => startReorder(o)}
                  onToggleFavorite={(e) => toggleFavorite(o, e)}
                  showFavoriteToggle={isLoggedIn}
                  reorderLoading={reorderLoading}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {reorderDialog && (
        <ReorderDialog
          dialog={reorderDialog}
          onCancel={() => setReorderDialog(null)}
          onConfirm={confirmReorder}
        />
      )}
    </div>
  );
}

// ─── Order row ──────────────────────────────────
function OrderRow({ order, onReorder, onToggleFavorite, showFavoriteToggle, reorderLoading }) {
  const navigate = useNavigate();
  const FulfillIcon = (FULFILL_META[order.fulfillment_type] || FULFILL_META.pickup).icon;
  const fulfillLabel = (FULFILL_META[order.fulfillment_type] || FULFILL_META.pickup).label;
  const statusMeta = STATUS_META[order.status] || STATUS_META.pending;
  const itemCount = (order.items || []).reduce((s, i) => s + (i.qty || 0), 0);
  const itemsSummary = (order.items || []).map((i) => i.name).slice(0, 3).join(", ") + ((order.items || []).length > 3 ? "…" : "");
  const dateStr = order.created_at ? new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  return (
    <div
      data-testid={`order-row-${order.order_number}`}
      className="bg-brand-surface border border-brand-border rounded-2xl p-5 hover:border-brand-primary/40 transition cursor-pointer"
      onClick={() => navigate(`/orders/track/${order.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") navigate(`/orders/track/${order.id}`); }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span data-testid={`order-number-${order.order_number}`} className="font-heading text-sm font-bold text-brand-text">{order.order_number}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-bg border border-brand-border text-[10px] font-body font-medium text-brand-text-secondary uppercase tracking-wider">
              <FulfillIcon size={10} /> {fulfillLabel}
            </span>
            <span data-testid={`order-status-${order.order_number}`} className={`text-[10px] px-2 py-0.5 rounded-full font-body font-semibold uppercase tracking-wider ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
          </div>
          <div className="font-body text-xs text-brand-text-secondary mb-2">
            <Clock size={11} className="inline mr-1" /> {dateStr} · {itemCount} item{itemCount !== 1 ? "s" : ""}
          </div>
          <div className="font-body text-sm text-brand-text truncate">{itemsSummary}</div>
        </div>

        <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-2">
          <span data-testid={`order-total-${order.order_number}`} className="font-heading text-xl font-bold text-brand-text">${(order.total || 0).toFixed(2)}</span>
          <div className="flex items-center gap-2">
            {showFavoriteToggle && (
              <button
                data-testid={`favorite-toggle-${order.order_number}`}
                onClick={onToggleFavorite}
                aria-label={order.starred ? "Remove from favorites" : "Save to favorites"}
                className={`p-2 rounded-full transition border ${order.starred ? "border-amber-300 bg-amber-50 text-amber-500" : "border-brand-border bg-brand-bg text-brand-text-secondary hover:text-amber-500 hover:border-amber-200"}`}
              >
                <Star size={14} className={order.starred ? "fill-amber-400 text-amber-400" : ""} />
              </button>
            )}
            <button
              data-testid={`reorder-btn-${order.order_number}`}
              onClick={(e) => { e.stopPropagation(); onReorder(); }}
              disabled={reorderLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-primary text-white font-body text-xs font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50 transition"
            >
              <RotateCcw size={12} /> Reorder
            </button>
            <Link
              to={`/orders/track/${order.id}`}
              data-testid={`order-detail-link-${order.order_number}`}
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-full border border-brand-border text-brand-text-secondary hover:text-brand-primary hover:border-brand-primary/40 transition"
              aria-label="View details"
            >
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reorder dialog ─────────────────────────────
function ReorderDialog({ dialog, onCancel, onConfirm }) {
  const { order, warnings, availableItems } = dialog;
  return (
    <div
      data-testid="reorder-dialog"
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center px-4 py-6"
      onClick={onCancel}
    >
      <div
        className="bg-brand-surface border border-brand-border rounded-2xl w-full max-w-lg p-6 animate-in slide-in-from-bottom-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-heading text-xl font-bold text-brand-text">Reorder {order.order_number}?</h3>
            <p className="font-body text-xs text-brand-text-secondary mt-1">{availableItems.length} available · {warnings.length} unavailable</p>
          </div>
          <button onClick={onCancel} data-testid="reorder-close-btn" className="p-2 rounded-full hover:bg-brand-bg text-brand-text-secondary" aria-label="Close"><X size={14} /></button>
        </div>

        {warnings.length > 0 && (
          <div data-testid="reorder-warnings" className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={14} className="text-amber-600" />
              <span className="font-heading text-sm font-semibold text-amber-800">Some items are unavailable</span>
            </div>
            <ul className="space-y-1">
              {warnings.map((w, i) => (
                <li key={i} data-testid={`reorder-warning-${i}`} className="font-body text-xs text-amber-800 flex justify-between gap-2">
                  <span>{w.name}</span>
                  <span className="font-semibold">{w.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {availableItems.length > 0 && (
          <div data-testid="reorder-items" className="mb-5 max-h-60 overflow-y-auto space-y-2">
            <div className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-2">We'll add these to your cart:</div>
            {availableItems.map((i, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-brand-bg border border-brand-border">
                {i.image && <img src={i.image} alt={i.name} className="w-10 h-10 rounded-lg object-cover" />}
                <div className="flex-1 min-w-0">
                  <div className="font-body text-sm font-semibold text-brand-text truncate">{i.name} <span className="text-brand-text-secondary">× {i.qty}</span></div>
                  {i.variant && <div className="font-body text-[11px] text-brand-primary">{i.variant.name}</div>}
                </div>
                <span className="font-body text-sm text-brand-text">${(i.price * i.qty).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {availableItems.length === 0 && (
          <div data-testid="reorder-nothing-available" className="mb-5 p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 mt-0.5" />
            <div className="font-body text-sm text-red-800">Nothing from this order is available right now. Please check back later.</div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            data-testid="reorder-cancel-btn"
            onClick={onCancel}
            className="flex-1 px-4 py-3 border border-brand-border text-brand-text font-body text-sm font-medium rounded-full hover:bg-brand-bg"
          >
            Cancel
          </button>
          <button
            data-testid="reorder-confirm-btn"
            onClick={onConfirm}
            disabled={availableItems.length === 0}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50 transition"
          >
            <CheckCircle2 size={14} /> Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}
