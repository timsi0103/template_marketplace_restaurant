import { useEffect, useState, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Package, MapPin, Clock, CheckCircle2, ChefHat, Truck, Utensils,
  AlertCircle, Loader2, CircleDot, Store, PhoneCall, Mail,
} from "lucide-react";

const POLL_INTERVAL = 10000;

const STATUS_FLOW_DELIVERY = [
  { key: "received", label: "Order Received", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Package },
];
const STATUS_FLOW_PICKUP = [
  { key: "received", label: "Order Received", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "ready", label: "Ready for Pickup", icon: Store },
  { key: "completed", label: "Picked Up", icon: CheckCircle2 },
];
const STATUS_FLOW_DINEIN = [
  { key: "received", label: "Order Received", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "ready", label: "Served", icon: Utensils },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

function currentStepIndex(order, steps) {
  if (!order) return 0;
  if (order.status === "rejected") return 0;
  const s = order.status;
  if (s === "pending") return 0;
  const map = { received: 0, preparing: 1, out_for_delivery: 2, ready: 2, delivered: 3, completed: 3 };
  return map[s] ?? 0;
}

export default function OrderTrackingPage() {
  const { order_id: paramId } = useParams();
  const [params] = useSearchParams();
  const queryId = params.get("order_id");
  const orderId = paramId || queryId;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const pollRef = useRef(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    let stopped = false;
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Order not found. Check the link.");
          throw new Error("Could not load order.");
        }
        const data = await res.json();
        if (!stopped) {
          setOrder(data);
          setError("");
          setLoading(false);
        }
      } catch (e) {
        if (!stopped) {
          setError(e.message);
          setLoading(false);
        }
      }
    };
    fetchOrder();
    pollRef.current = setInterval(fetchOrder, POLL_INTERVAL);
    return () => { stopped = true; clearInterval(pollRef.current); };
  }, [orderId]);

  if (!orderId) {
    return (
      <div data-testid="tracking-no-id" className="min-h-screen flex items-center justify-center bg-brand-bg px-4">
        <div className="text-center max-w-md">
          <Package size={40} className="mx-auto text-brand-border mb-4" />
          <h1 className="font-heading text-2xl font-bold text-brand-text mb-2">Track your order</h1>
          <p className="font-body text-sm text-brand-text-secondary mb-6">Enter a tracking link or use the link sent to your email.</p>
          <Link to="/menu" className="inline-block px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full">Back to menu</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div data-testid="tracking-loading" className="min-h-screen flex items-center justify-center bg-brand-bg">
        <Loader2 size={36} className="animate-spin text-brand-primary" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div data-testid="tracking-error" className="min-h-screen flex items-center justify-center bg-brand-bg px-4">
        <div className="text-center max-w-md">
          <AlertCircle size={40} className="mx-auto text-red-500 mb-4" />
          <h1 className="font-heading text-2xl font-bold text-brand-text mb-2">Couldn't load order</h1>
          <p className="font-body text-sm text-brand-text-secondary mb-6">{error || "Order not found."}</p>
          <Link to="/menu" className="inline-block px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full">Back to menu</Link>
        </div>
      </div>
    );
  }

  const steps =
    order.fulfillment_type === "delivery" ? STATUS_FLOW_DELIVERY :
    order.fulfillment_type === "pickup" ? STATUS_FLOW_PICKUP : STATUS_FLOW_DINEIN;
  const currentIdx = currentStepIndex(order, steps);
  const finalStep = currentIdx >= steps.length - 1;

  // Countdown (ETA)
  const createdMs = order.created_at ? Date.parse(order.created_at) : now;
  const etaMs = createdMs + (order.estimated_minutes || 30) * 60 * 1000;
  const remainingSec = Math.max(0, Math.floor((etaMs - now) / 1000));
  const mm = Math.floor(remainingSec / 60);
  const ss = remainingSec % 60;

  return (
    <div data-testid="order-tracking-page" className="min-h-screen bg-brand-bg pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {order.status === "rejected" && (
          <div data-testid="tracking-rejected" className="mb-6 p-4 rounded-xl border-2 border-red-300 bg-red-50 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-heading font-bold text-red-800">Order rejected by the restaurant</div>
              <div className="font-body text-xs text-red-700 mt-0.5">{order.rejection_reason || "We're sorry — please try again or contact support."}</div>
            </div>
          </div>
        )}

        {/* Header */}
        <div data-testid="tracking-header" className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Order</div>
            <h1 data-testid="tracking-order-number" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">{order.order_number}</h1>
            <p className="font-body text-sm text-brand-text-secondary mt-1 capitalize">{(order.fulfillment_type || "").replace("_", "-")}</p>
          </div>
          {!finalStep && order.status !== "rejected" ? (
            <div data-testid="tracking-eta" className="px-4 py-3 rounded-xl bg-brand-surface border border-brand-border">
              <div className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Est. time</div>
              <div className="font-heading text-2xl font-bold text-brand-primary">{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</div>
            </div>
          ) : (
            finalStep && (
              <div data-testid="tracking-complete-badge" className="px-4 py-3 rounded-xl bg-green-50 border border-green-200 inline-flex items-center gap-2">
                <CheckCircle2 size={18} className="text-green-600" />
                <span className="font-heading text-sm font-semibold text-green-800">{order.fulfillment_type === "delivery" ? "Delivered" : "Complete"}</span>
              </div>
            )
          )}
        </div>

        {/* Stepper */}
        <div data-testid="tracking-stepper" className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-7 mb-6">
          <div className="grid grid-cols-4 gap-2 sm:gap-4">
            {steps.map((s, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx && order.status !== "rejected";
              const Icon = s.icon;
              return (
                <div key={s.key} data-testid={`tracking-step-${s.key}`} className="text-center">
                  <div className="relative flex items-center justify-center mb-2">
                    {idx > 0 && (
                      <div className={`absolute left-0 right-1/2 top-1/2 -translate-y-1/2 h-0.5 ${done || active ? "bg-brand-primary" : "bg-brand-border"}`} />
                    )}
                    {idx < steps.length - 1 && (
                      <div className={`absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-0.5 ${done ? "bg-brand-primary" : "bg-brand-border"}`} />
                    )}
                    <div className={`relative z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition ${
                      done ? "bg-brand-primary text-white" :
                      active ? "bg-brand-primary text-white ring-4 ring-brand-primary/20 animate-pulse" :
                      "bg-brand-bg border-2 border-brand-border text-brand-text-secondary"
                    }`}>
                      {done ? <CheckCircle2 size={18} /> : active ? <Icon size={18} /> : <CircleDot size={14} />}
                    </div>
                  </div>
                  <div className={`font-body text-[11px] sm:text-xs font-medium ${done || active ? "text-brand-text" : "text-brand-text-secondary"}`}>{s.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Details */}
        <div data-testid="tracking-details-card" className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-7 mb-6">
          <h2 className="font-heading text-base font-bold text-brand-text mb-4">Order details</h2>
          <div className="space-y-4">
            {(order.items || []).map((it, i) => (
              <div key={i} className="flex gap-3" data-testid={`tracking-item-${i}`}>
                {it.image && <img src={it.image} alt={it.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                <div className="flex-1">
                  <div className="flex justify-between gap-2">
                    <span className="font-heading text-sm font-semibold text-brand-text">{it.name} <span className="font-body text-xs text-brand-text-secondary">× {it.qty}</span></span>
                    <span className="font-heading text-sm font-semibold text-brand-text">${(it.price * it.qty).toFixed(2)}</span>
                  </div>
                  {it.variant_name && <div className="font-body text-[11px] text-brand-primary font-semibold">{it.variant_name}</div>}
                  {it.modifiers?.length > 0 && <div className="font-body text-[11px] text-brand-text-secondary">{it.modifiers.map((m) => m.name).join(" · ")}</div>}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-brand-border grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <MapPin size={14} className="text-brand-primary mt-0.5" />
              <div>
                <div className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">{order.fulfillment_type === "delivery" ? "Delivery to" : order.fulfillment_type === "pickup" ? "Pickup from" : "Dining at"}</div>
                <div className="font-body text-xs text-brand-text">
                  {order.fulfillment_type === "delivery" && order.address ? `${order.address.line1}${order.address.line2 ? `, ${order.address.line2}` : ""}, ${order.address.city || ""}` :
                   order.fulfillment_type === "dine_in" ? `Table ${order.table_number}` : "The Culinary Editorial, 123 Epicurean Way"}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock size={14} className="text-brand-primary mt-0.5" />
              <div>
                <div className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Schedule</div>
                <div className="font-body text-xs text-brand-text">{order.scheduled_slot === "ASAP" ? "As soon as possible" : order.scheduled_slot}</div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-brand-border space-y-1.5 text-sm font-body">
            <Row label="Subtotal" value={`$${(order.subtotal || 0).toFixed(2)}`} />
            {order.discount > 0 && <Row label={`Discount${order.promo_applied ? ` (${order.promo_applied})` : ""}`} value={`−$${order.discount.toFixed(2)}`} className="text-green-700" />}
            {order.fulfillment_type === "delivery" && <Row label="Delivery fee" value={`$${(order.delivery_fee || 0).toFixed(2)}`} />}
            <Row label="Tax" value={`$${(order.tax || 0).toFixed(2)}`} />
            {order.tip > 0 && <Row label="Tip" value={`$${order.tip.toFixed(2)}`} />}
          </div>
          <div className="flex justify-between pt-3 mt-2 border-t border-brand-border font-heading">
            <span className="text-base font-bold text-brand-text">Total paid</span>
            <span data-testid="tracking-total" className="text-2xl font-bold text-brand-text">${(order.total || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Support */}
        <div data-testid="tracking-support" className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left justify-center">
          <span className="font-body text-sm text-brand-text-secondary">Need help?</span>
          <a href="mailto:support@culinaryeditorial.com" className="inline-flex items-center gap-1.5 font-body text-sm text-brand-primary underline underline-offset-2">
            <Mail size={14} /> support@culinaryeditorial.com
          </a>
          <a href="tel:+15550001234" className="inline-flex items-center gap-1.5 font-body text-sm text-brand-primary underline underline-offset-2">
            <PhoneCall size={14} /> +1 (555) 000-1234
          </a>
        </div>

        {/* Reorder CTA */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/orders"
            data-testid="tracking-view-all-btn"
            className="px-6 py-3 border border-brand-border text-brand-text font-body text-sm font-medium rounded-full hover:bg-brand-surface transition inline-flex items-center gap-2"
          >
            <Package size={14} /> All orders
          </Link>
          <Link
            to={`/orders?reorder=${order.id}`}
            onClick={(e) => {
              e.preventDefault();
              // Reorder is handled on the list page; send user there with query
              window.location.href = `/orders?reorder=${order.id}`;
            }}
            data-testid="tracking-reorder-btn"
            className="px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover inline-flex items-center gap-2"
          >
            Reorder these items
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, className = "" }) {
  return (
    <div className={`flex justify-between text-brand-text-secondary ${className}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
