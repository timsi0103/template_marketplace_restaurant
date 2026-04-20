import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, AlertCircle, Truck, Store, Utensils, MapPin, Package, ArrowRight, Mail, ChevronDown, ChevronUp, Printer } from "lucide-react";

const POLL_INTERVAL = 2000;
const MAX_ATTEMPTS = 10;

export default function OrderSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const orderIdParam = params.get("order_id");

  const [state, setState] = useState({ loading: true, status: "pending", payment_status: "pending", order: null, error: "" });
  const [emailOpen, setEmailOpen] = useState(false);
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
    const reasonLabel = state.status === "expired" ? "Session expired" :
                        state.payment_status === "failed" ? "Card declined" :
                        "Payment not completed";
    return (
      <div data-testid="order-success-error" className="min-h-screen flex items-center justify-center bg-brand-bg px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-5">
            <AlertCircle size={32} className="text-red-500" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-brand-text mb-2">{reasonLabel}</h1>
          <p className="font-body text-sm text-brand-text-secondary mb-1">{state.error || "Your payment was not completed. Please try again."}</p>
          <p data-testid="failed-reason" className="font-body text-[11px] uppercase tracking-widest text-brand-text-secondary mb-6">Reason · {state.payment_status || "unknown"}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/checkout" data-testid="retry-checkout-btn" className="px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full">Try again</Link>
            <Link to="/menu" data-testid="back-to-menu-btn" className="px-6 py-3 border border-brand-border text-brand-text font-body text-sm font-medium rounded-full">Back to menu</Link>
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
          <div data-testid="success-check" className="relative w-24 h-24 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full bg-green-100 animate-[ping_1s_ease-out_1] opacity-60" />
            <div className="absolute inset-0 rounded-full bg-green-100 border-4 border-green-200" />
            <div className="absolute inset-0 flex items-center justify-center">
              <CheckCircle2 size={48} className="text-green-600 animate-[scale-in_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)_1]" style={{ transformOrigin: "center" }} />
            </div>
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

        {/* Email receipt preview (collapsible) */}
        <div data-testid="email-preview-section" className="mt-6">
          <button
            data-testid="email-preview-toggle"
            onClick={() => setEmailOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-brand-surface border border-brand-border hover:border-brand-primary/40 transition text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail size={16} className="text-brand-primary" />
              </div>
              <div className="min-w-0">
                <div className="font-heading text-sm font-bold text-brand-text">Preview receipt email</div>
                <div className="font-body text-xs text-brand-text-secondary truncate">Sent to {order.contact_email}</div>
              </div>
            </div>
            {emailOpen ? <ChevronUp size={16} className="text-brand-text-secondary" /> : <ChevronDown size={16} className="text-brand-text-secondary" />}
          </button>

          {emailOpen && (
            <EmailPreview order={order} orderIdParam={orderIdParam} />
          )}
        </div>

        {/* CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={`/orders/track/${orderIdParam || order.id || ""}`}
            data-testid="track-order-btn"
            className="px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover transition inline-flex items-center justify-center gap-2"
          >
            <Package size={16} /> Track your order
          </Link>
          <Link
            to={`/receipt/${orderIdParam || order.id || ""}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="print-receipt-btn"
            className="px-6 py-3 border border-brand-border text-brand-text font-body text-sm font-medium rounded-full hover:bg-brand-surface transition inline-flex items-center justify-center gap-2"
          >
            <Printer size={16} /> Print receipt
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

// ─── Styled email template preview (marketing mockup) ───
function EmailPreview({ order, orderIdParam }) {
  const ItemRow = ({ it }) => (
    <tr>
      <td style={{ padding: "8px 0", fontSize: 13, color: "#1A1A1A", fontFamily: "Georgia, serif" }}>
        {it.name} <span style={{ color: "#8A8A8A" }}>× {it.qty}</span>
        {it.variant_name && <span style={{ display: "block", color: "#6E1C1E", fontSize: 11 }}>{it.variant_name}</span>}
      </td>
      <td align="right" style={{ padding: "8px 0", fontSize: 13, color: "#1A1A1A", fontFamily: "Georgia, serif" }}>${(it.price * it.qty).toFixed(2)}</td>
    </tr>
  );

  const trackUrl = `/orders/track/${orderIdParam || order.id || ""}`;

  return (
    <div data-testid="email-preview-content" className="mt-3 rounded-2xl bg-white border border-brand-border overflow-hidden shadow-sm">
      {/* Email header strip */}
      <div className="px-5 py-3 bg-[#F8F5F0] border-b border-brand-border text-[11px] font-mono text-brand-text-secondary">
        <div>From: receipts@culinaryeditorial.com</div>
        <div>To: {order.contact_email}</div>
        <div>Subject: Your order {order.order_number} is confirmed 🧑‍🍳</div>
      </div>

      {/* Email body */}
      <div className="px-6 sm:px-10 py-8" style={{ backgroundColor: "#FAFAF7" }}>
        <div className="text-center mb-6">
          <div style={{ fontFamily: "Georgia, serif", color: "#6E1C1E", fontSize: 20, fontWeight: 600 }}>The Culinary Editorial</div>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#8A8A8A", marginTop: 2 }}>Order Receipt</div>
        </div>

        <div className="text-center mb-6">
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 26, color: "#1A1A1A", margin: 0 }}>Thank you, {(order.contact_name || order.contact_email.split("@")[0]).split(" ")[0]}</h1>
          <p style={{ fontSize: 13, color: "#4A4A4A", marginTop: 6 }}>Your order <strong style={{ color: "#6E1C1E" }}>{order.order_number}</strong> has been confirmed and is being prepared.</p>
        </div>

        {/* Order meta */}
        <div className="rounded-xl p-4 mb-6" style={{ background: "#F3EFE8", border: "1px solid #E5E0D8" }}>
          <div className="grid grid-cols-2 gap-3 text-[12px] font-body text-[#1A1A1A]">
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#8A8A8A" }}>Estimated</div>
              <div style={{ fontWeight: 600 }}>{order.scheduled_slot === "ASAP" ? `~${order.estimated_minutes || 30} min` : order.scheduled_slot}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#8A8A8A" }}>Fulfillment</div>
              <div style={{ fontWeight: 600, textTransform: "capitalize" }}>{(order.fulfillment_type || "").replace("_", "-")}</div>
            </div>
            <div className="col-span-2">
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#8A8A8A" }}>
                {order.fulfillment_type === "delivery" ? "Delivery address" : order.fulfillment_type === "dine_in" ? "Table" : "Pickup location"}
              </div>
              <div style={{ fontWeight: 500 }}>
                {order.fulfillment_type === "delivery" && order.address ? `${order.address.line1}${order.address.line2 ? `, ${order.address.line2}` : ""}, ${order.address.city || ""}` :
                 order.fulfillment_type === "dine_in" ? `Table ${order.table_number}` :
                 "123 Epicurean Way, New York, NY 10013"}
              </div>
            </div>
          </div>
        </div>

        {/* Items */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #D9D4C9" }}>
              <th align="left" style={{ padding: "8px 0", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#8A8A8A", fontWeight: 600 }}>Items</th>
              <th align="right" style={{ padding: "8px 0", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#8A8A8A", fontWeight: 600 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((it, i) => <ItemRow key={i} it={it} />)}
          </tbody>
          <tfoot style={{ borderTop: "2px solid #D9D4C9" }}>
            <tr><td style={{ padding: "8px 0", fontSize: 12, color: "#6B6B6B" }}>Subtotal</td><td align="right" style={{ padding: "8px 0", fontSize: 12, color: "#6B6B6B" }}>${(order.subtotal || 0).toFixed(2)}</td></tr>
            {order.discount > 0 && <tr><td style={{ padding: "4px 0", fontSize: 12, color: "#0F7A3F" }}>Discount{order.promo_applied ? ` (${order.promo_applied})` : ""}</td><td align="right" style={{ padding: "4px 0", fontSize: 12, color: "#0F7A3F" }}>−${order.discount.toFixed(2)}</td></tr>}
            {order.fulfillment_type === "delivery" && <tr><td style={{ padding: "4px 0", fontSize: 12, color: "#6B6B6B" }}>Delivery fee</td><td align="right" style={{ padding: "4px 0", fontSize: 12, color: "#6B6B6B" }}>${(order.delivery_fee || 0).toFixed(2)}</td></tr>}
            <tr><td style={{ padding: "4px 0", fontSize: 12, color: "#6B6B6B" }}>Tax</td><td align="right" style={{ padding: "4px 0", fontSize: 12, color: "#6B6B6B" }}>${(order.tax || 0).toFixed(2)}</td></tr>
            {order.tip > 0 && <tr><td style={{ padding: "4px 0", fontSize: 12, color: "#6B6B6B" }}>Tip</td><td align="right" style={{ padding: "4px 0", fontSize: 12, color: "#6B6B6B" }}>${order.tip.toFixed(2)}</td></tr>}
            <tr><td style={{ padding: "10px 0 0", fontSize: 14, color: "#1A1A1A", fontWeight: 700, fontFamily: "Georgia, serif" }}>Total</td><td align="right" style={{ padding: "10px 0 0", fontSize: 18, color: "#1A1A1A", fontWeight: 700, fontFamily: "Georgia, serif" }}>${(order.total || 0).toFixed(2)}</td></tr>
          </tfoot>
        </table>

        {/* CTA */}
        <div className="mt-6 text-center">
          <a href={trackUrl} style={{ display: "inline-block", padding: "12px 28px", borderRadius: 999, background: "#6E1C1E", color: "white", textDecoration: "none", fontSize: 13, fontWeight: 600, letterSpacing: 0.3 }}>
            Track your order
          </a>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 text-center" style={{ borderTop: "1px solid #E5E0D8" }}>
          <p style={{ fontSize: 11, color: "#8A8A8A", margin: 0 }}>Questions? Reply to this email or reach us at <a href="mailto:support@culinaryeditorial.com" style={{ color: "#6E1C1E" }}>support@culinaryeditorial.com</a></p>
          <p style={{ fontSize: 10, color: "#B0B0B0", marginTop: 6 }}>The Culinary Editorial · 123 Epicurean Way, New York, NY 10013</p>
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
