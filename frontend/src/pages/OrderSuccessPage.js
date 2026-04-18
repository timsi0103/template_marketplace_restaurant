import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, AlertCircle, Truck, Store, Utensils, MapPin, Package, ArrowRight } from "lucide-react";

const POLL_INTERVAL = 2000;
const MAX_ATTEMPTS = 10;

export default function OrderSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const orderIdParam = params.get("order_id");

  const [state, setState] = useState({ loading: true, status: "pending", payment_status: "pending", order: null, error: "" });
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setState({ loading: false, status: "error", payment_status: "error", order: null, error: "Missing session id" });
      return;
    }
    let stopped = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/payments/status/${sessionId}`);
        if (!res.ok) throw new Error("Unable to fetch status");
        const data = await res.json();
        if (stopped) return;
        if (data.payment_status === "paid") {
          setState({ loading: false, status: "paid", payment_status: "paid", order: data.order, error: "" });
          return;
        }
        if (data.status === "expired" || data.payment_status === "failed") {
          setState({ loading: false, status: data.status, payment_status: data.payment_status, order: data.order, error: "Payment was not completed." });
          return;
        }
        attemptsRef.current += 1;
        if (attemptsRef.current >= MAX_ATTEMPTS) {
          setState({ loading: false, status: data.status, payment_status: data.payment_status, order: data.order, error: "Timed out checking status. Please refresh or check your email for confirmation." });
          return;
        }
        setTimeout(poll, POLL_INTERVAL);
      } catch (e) {
        if (stopped) return;
        attemptsRef.current += 1;
        if (attemptsRef.current >= MAX_ATTEMPTS) {
          setState({ loading: false, status: "error", payment_status: "error", order: null, error: e.message || "Could not verify payment" });
          return;
        }
        setTimeout(poll, POLL_INTERVAL);
      }
    };
    poll();
    return () => { stopped = true; };
  }, [sessionId]);

  if (state.loading) {
    return (
      <div data-testid="order-success-loading" className="min-h-screen flex items-center justify-center bg-brand-bg px-4">
        <div className="text-center max-w-md">
          <Loader2 size={48} className="mx-auto text-brand-primary animate-spin mb-5" />
          <h1 className="font-heading text-2xl font-bold text-brand-text mb-2">Confirming your payment…</h1>
          <p className="font-body text-sm text-brand-text-secondary">Hang tight — we're checking with Stripe. This usually takes a few seconds.</p>
        </div>
      </div>
    );
  }

  if (state.payment_status !== "paid") {
    return (
      <div data-testid="order-success-error" className="min-h-screen flex items-center justify-center bg-brand-bg px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-5">
            <AlertCircle size={32} className="text-red-500" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-brand-text mb-2">Payment not completed</h1>
          <p className="font-body text-sm text-brand-text-secondary mb-6">{state.error || "Your payment was not completed. Please try again."}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/checkout" data-testid="retry-checkout-btn" className="px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full">Try again</Link>
            <Link to="/menu" className="px-6 py-3 border border-brand-border text-brand-text font-body text-sm font-medium rounded-full">Back to menu</Link>
          </div>
        </div>
      </div>
    );
  }

  const order = state.order || {};
  const FulfillIcon = order.fulfillment_type === "delivery" ? Truck : order.fulfillment_type === "pickup" ? Store : Utensils;

  return (
    <div data-testid="order-success-page" className="min-h-screen bg-brand-bg pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* Success banner */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-green-100 border-4 border-green-200 flex items-center justify-center mx-auto mb-4 animate-[ping_0.6s_ease-out_1]">
            <CheckCircle2 size={40} className="text-green-600" />
          </div>
          <h1 data-testid="success-heading" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">
            Thank you! Your order is confirmed.
          </h1>
          <p className="font-body text-sm text-brand-text-secondary mt-2">
            We've emailed a receipt to <span className="text-brand-text font-semibold">{order.contact_email || "your email"}</span>.
          </p>
        </div>

        {/* Order card */}
        <div data-testid="success-order-card" className="bg-brand-surface border border-brand-border rounded-2xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-brand-border">
            <div>
              <div className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Order number</div>
              <div data-testid="success-order-number" className="font-heading text-xl font-bold text-brand-text">{order.order_number}</div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
              <CheckCircle2 size={14} className="text-green-600" />
              <span className="font-body text-xs font-semibold text-green-700 capitalize">{order.status || "Confirmed"}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-5 border-b border-brand-border">
            <div className="flex items-start gap-3">
              <FulfillIcon size={18} className="text-brand-primary mt-0.5" />
              <div>
                <div className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Fulfillment</div>
                <div className="font-heading text-sm font-semibold text-brand-text capitalize">{(order.fulfillment_type || "").replace("_", "-")}</div>
                {order.fulfillment_type === "delivery" && order.address?.line1 && (
                  <div className="font-body text-xs text-brand-text-secondary mt-0.5 inline-flex items-center gap-1">
                    <MapPin size={11} /> {order.address.line1}, {order.address.city || ""}
                  </div>
                )}
                {order.fulfillment_type === "dine_in" && <div className="font-body text-xs text-brand-text-secondary mt-0.5">Table {order.table_number}</div>}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock size={18} className="text-brand-primary mt-0.5" />
              <div>
                <div className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Estimated time</div>
                <div data-testid="success-eta" className="font-heading text-sm font-semibold text-brand-text">
                  {order.scheduled_slot === "ASAP" ? `~${order.estimated_minutes || 30} min` : order.scheduled_slot}
                </div>
              </div>
            </div>
          </div>

          {/* Itemized list */}
          <div data-testid="success-items" className="py-5 border-b border-brand-border space-y-3">
            {(order.items || []).map((item, idx) => (
              <div key={idx} className="flex items-start gap-3" data-testid={`success-item-${idx}`}>
                {item.image && <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-heading text-sm font-semibold text-brand-text">
                      {item.name} <span className="font-body text-xs text-brand-text-secondary">× {item.qty}</span>
                    </span>
                    <span className="font-heading text-sm font-semibold text-brand-text">${(item.price * item.qty).toFixed(2)}</span>
                  </div>
                  {item.variant_name && <div className="font-body text-[11px] text-brand-primary font-semibold">{item.variant_name}</div>}
                  {item.modifiers?.length > 0 && (
                    <div className="font-body text-[11px] text-brand-text-secondary mt-0.5">
                      {item.modifiers.map((m) => m.name).join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="py-5 space-y-1.5 text-sm font-body">
            <Row label="Subtotal" value={`$${(order.subtotal || 0).toFixed(2)}`} />
            {order.discount > 0 && <Row label="Discount" value={`−$${order.discount.toFixed(2)}`} className="text-green-700" />}
            {order.fulfillment_type === "delivery" && <Row label="Delivery fee" value={`$${(order.delivery_fee || 0).toFixed(2)}`} />}
            <Row label="Tax" value={`$${(order.tax || 0).toFixed(2)}`} />
            {order.tip > 0 && <Row label="Tip" value={`$${order.tip.toFixed(2)}`} />}
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-brand-border font-heading">
            <span className="text-base font-bold text-brand-text">Total paid</span>
            <span data-testid="success-total" className="text-2xl font-bold text-brand-text">${(order.total || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={`/orders${orderIdParam ? `?order_id=${orderIdParam}` : ""}`}
            data-testid="track-order-btn"
            className="px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover transition inline-flex items-center justify-center gap-2"
          >
            <Package size={16} /> Track your order
          </Link>
          <Link
            to="/menu"
            data-testid="continue-shopping-btn"
            className="px-6 py-3 border border-brand-border text-brand-text font-body text-sm font-medium rounded-full hover:bg-brand-surface transition inline-flex items-center justify-center gap-2"
          >
            Continue shopping <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, className = "" }) {
  return (
    <div className={`flex items-center justify-between text-brand-text-secondary ${className}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
