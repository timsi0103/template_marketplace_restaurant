import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Truck, Store, Utensils, MapPin, Clock,
  CreditCard, Lock, Tag, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import AddressAutocomplete from "@/components/checkout/AddressAutocomplete";
import TimeSlotPicker from "@/components/checkout/TimeSlotPicker";
import CheckoutStepper from "@/components/checkout/CheckoutStepper";

const STEPS = [
  { key: "fulfillment", label: "Fulfillment" },
  { key: "address", label: "Address" },
  { key: "time", label: "Time" },
  { key: "summary", label: "Summary" },
  { key: "payment", label: "Payment" },
];

const TAX_RATE = 0.0875;
const DELIVERY_FEE = 4.99;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, subtotal, clearCart } = useCart();
  const [searchParams] = useSearchParams();

  const [stepIdx, setStepIdx] = useState(0);
  const [fulfillment, setFulfillment] = useState("delivery");
  const [address, setAddress] = useState({ label: "", line1: "", line2: "", city: "", postal_code: "", lat: null, lng: null, notes: "" });
  const [savedAddresses] = useState(() => {
    try { return JSON.parse(localStorage.getItem("saved_addresses") || "[]"); } catch { return []; }
  });
  const [tableNumber, setTableNumber] = useState("");
  const [slot, setSlot] = useState("ASAP");
  const [tip, setTip] = useState(0);
  const [tipMode, setTipMode] = useState("none");
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState({ valid: false, rule: null, error: "" });
  const [contact, setContact] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
  });
  const [placing, setPlacing] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  useEffect(() => {
    if (user?.email && !contact.email) {
      setContact((c) => ({ ...c, email: user.email, name: user.name || c.name }));
    }
    // eslint-disable-next-line
  }, [user]);

  useEffect(() => {
    if (searchParams.get("cancelled") === "1") {
      toast.error("Payment cancelled", { description: "Your order was not placed." });
    }
  }, [searchParams]);

  const pricing = useMemo(() => {
    const sub = subtotal;
    const deliveryFee = fulfillment === "delivery" ? DELIVERY_FEE : 0;
    let discount = 0;
    if (promoStatus.valid && promoStatus.rule) {
      const r = promoStatus.rule;
      if (r.type === "percent") discount = sub * (r.value / 100);
      else if (r.type === "flat") discount = r.value;
      else if (r.type === "free_delivery") discount = deliveryFee;
    }
    const taxable = Math.max(0, sub - discount);
    const tax = taxable * TAX_RATE;
    const total = Math.max(0, sub - discount + deliveryFee + tax + Number(tip || 0));
    return { sub, deliveryFee, discount, tax, total };
  }, [subtotal, fulfillment, promoStatus, tip]);

  const canAdvance = () => {
    if (items.length === 0) return false;
    switch (STEPS[stepIdx].key) {
      case "fulfillment":
        if (fulfillment === "dine_in" && !tableNumber.trim()) return false;
        return true;
      case "address":
        if (fulfillment === "delivery") return !!address.line1 && !!address.city;
        return true;
      case "time":
        return !!slot;
      case "summary":
        return !!contact.email && /\S+@\S+\.\S+/.test(contact.email);
      case "payment":
        return agreeTerms;
      default:
        return true;
    }
  };

  const effectiveSteps = useMemo(() => {
    if (fulfillment === "delivery") return STEPS;
    return STEPS.filter((s) => s.key !== "address");
  }, [fulfillment]);
  const currentStepKey = STEPS[stepIdx].key;

  const nextStep = () => {
    if (!canAdvance()) return;
    let next = stepIdx + 1;
    if (fulfillment !== "delivery" && STEPS[next]?.key === "address") next += 1;
    if (next >= STEPS.length) return;
    setStepIdx(next);
  };
  const prevStep = () => {
    if (stepIdx === 0) {
      navigate(-1);
      return;
    }
    let prev = stepIdx - 1;
    if (fulfillment !== "delivery" && STEPS[prev]?.key === "address") prev -= 1;
    if (prev < 0) prev = 0;
    setStepIdx(prev);
  };

  const applyPromo = async () => {
    if (!promoCode.trim()) return;
    try {
      const res = await fetch("/api/orders/validate-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode.trim(), subtotal }),
      });
      const data = await res.json();
      if (data.valid) {
        setPromoStatus({ valid: true, rule: data.rule, error: "" });
        toast.success("Promo applied", { description: data.description });
      } else {
        setPromoStatus({ valid: false, rule: null, error: data.error || "Invalid code" });
        toast.error(data.error || "Invalid promo code");
      }
    } catch {
      toast.error("Could not validate promo code");
    }
  };

  const saveAddressIfNew = () => {
    if (!user?.email || !address.line1) return;
    const exists = savedAddresses.some((a) => a.line1 === address.line1 && a.postal_code === address.postal_code);
    if (!exists) {
      const next = [...savedAddresses, { ...address, saved_at: Date.now() }];
      localStorage.setItem("saved_addresses", JSON.stringify(next));
    }
  };

  const placeOrder = async () => {
    if (!canAdvance() || placing) return;
    setPlacing(true);
    try {
      saveAddressIfNew();
      const payload = {
        items: items.map((i) => ({
          item_id: i.id,
          variant_id: i.variant?.id || null,
          modifiers: (i.modifiers || []).map((m) => ({ group: m.group, name: m.name, price: m.price || 0 })),
          qty: i.qty,
          instructions: i.instructions || "",
        })),
        fulfillment_type: fulfillment,
        address: fulfillment === "delivery" ? address : null,
        table_number: fulfillment === "dine_in" ? tableNumber : null,
        scheduled_slot: slot,
        tip: Number(tip || 0),
        promo_code: promoStatus.valid ? promoCode.trim().toUpperCase() : null,
        contact_email: contact.email,
        contact_name: contact.name || "",
        contact_phone: contact.phone || "",
        origin_url: window.location.origin,
      };
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to place order");
      }
      const data = await res.json();
      try {
        localStorage.setItem("last_order_context", JSON.stringify({
          order_id: data.order_id,
          order_number: data.order_number,
          contact_email: contact.email,
          fulfillment_type: fulfillment,
        }));
      } catch { /* ignore */ }
      clearCart();
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error("Checkout failed", { description: e.message });
      setPlacing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div data-testid="checkout-empty" className="min-h-screen bg-brand-bg flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-brand-surface flex items-center justify-center mb-5 border border-brand-border">
          <AlertCircle size={32} className="text-brand-text-secondary" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-brand-text mb-2">Your cart is empty</h1>
        <p className="font-body text-sm text-brand-text-secondary max-w-md mb-6">Add a few items from the menu to begin checkout.</p>
        <Link data-testid="checkout-empty-menu-btn" to="/menu" className="px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full">
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div data-testid="checkout-page" className="min-h-screen bg-brand-bg pb-32 lg:pb-12">
      <div className="border-b border-brand-border bg-brand-bg sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <button
            data-testid="checkout-back-btn"
            onClick={prevStep}
            className="text-brand-text hover:text-brand-primary transition-colors p-1 flex items-center gap-1 font-body text-sm"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">Back</span>
          </button>
          <span className="font-heading text-base sm:text-xl font-semibold text-brand-primary">The Culinary Editorial</span>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
        <h1 data-testid="checkout-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text mb-4">
          Checkout
        </h1>

        <CheckoutStepper steps={effectiveSteps} currentKey={currentStepKey} />

        <div className="mt-6 flex flex-col lg:grid lg:grid-cols-5 lg:gap-8">
          <div className="lg:col-span-3 bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-7">
            {currentStepKey === "fulfillment" && (
              <FulfillmentStep
                fulfillment={fulfillment}
                setFulfillment={setFulfillment}
                tableNumber={tableNumber}
                setTableNumber={setTableNumber}
              />
            )}
            {currentStepKey === "address" && (
              <AddressStep
                address={address}
                setAddress={setAddress}
                savedAddresses={savedAddresses}
                isLoggedIn={!!user?.email && !user?.guest}
              />
            )}
            {currentStepKey === "time" && (
              <TimeStep slot={slot} setSlot={setSlot} fulfillment={fulfillment} />
            )}
            {currentStepKey === "summary" && (
              <SummaryStep
                items={items}
                pricing={pricing}
                contact={contact}
                setContact={setContact}
                promoCode={promoCode}
                setPromoCode={setPromoCode}
                promoStatus={promoStatus}
                applyPromo={applyPromo}
                tip={tip}
                setTip={setTip}
                tipMode={tipMode}
                setTipMode={setTipMode}
                fulfillment={fulfillment}
                slot={slot}
                address={address}
                tableNumber={tableNumber}
                isGuest={!user?.email || user?.guest}
              />
            )}
            {currentStepKey === "payment" && (
              <PaymentStep
                total={pricing.total}
                agreeTerms={agreeTerms}
                setAgreeTerms={setAgreeTerms}
                contact={contact}
              />
            )}

            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                data-testid="checkout-prev-btn"
                onClick={prevStep}
                className="px-5 py-3 border border-brand-border text-brand-text font-body text-sm font-medium rounded-full hover:bg-brand-bg transition-colors"
              >
                <span className="inline-flex items-center gap-1"><ArrowLeft size={14} /> Back</span>
              </button>
              {currentStepKey !== "payment" ? (
                <button
                  data-testid="checkout-next-btn"
                  onClick={nextStep}
                  disabled={!canAdvance()}
                  className="px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <span className="inline-flex items-center gap-1.5">Continue <ArrowRight size={14} /></span>
                </button>
              ) : (
                <button
                  data-testid="checkout-place-order-btn"
                  onClick={placeOrder}
                  disabled={!canAdvance() || placing}
                  className="px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2"
                >
                  {placing ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                  {placing ? "Redirecting…" : `Pay $${pricing.total.toFixed(2)}`}
                </button>
              )}
            </div>
          </div>

          <OrderSummaryCard items={items} pricing={pricing} fulfillment={fulfillment} slot={slot} />
        </div>
      </div>
    </div>
  );
}

function FulfillmentStep({ fulfillment, setFulfillment, tableNumber, setTableNumber }) {
  const options = [
    { key: "delivery", label: "Delivery", desc: "Fresh to your door", icon: Truck },
    { key: "pickup", label: "Pickup", desc: "Ready at our store", icon: Store },
    { key: "dine_in", label: "Dine-In", desc: "Served at your table", icon: Utensils },
  ];
  return (
    <div data-testid="step-fulfillment">
      <h2 className="font-heading text-xl font-bold text-brand-text mb-1">How would you like to receive your order?</h2>
      <p className="font-body text-sm text-brand-text-secondary mb-5">Choose the option that works best for you.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = fulfillment === opt.key;
          return (
            <button
              key={opt.key}
              data-testid={`fulfillment-${opt.key}`}
              onClick={() => setFulfillment(opt.key)}
              className={`group text-left p-4 rounded-xl border-2 transition-all active:scale-[0.98] ${
                active
                  ? "border-brand-primary bg-brand-primary/5"
                  : "border-brand-border bg-brand-bg hover:border-brand-primary/40"
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${active ? "bg-brand-primary text-white" : "bg-brand-surface text-brand-text"}`}>
                <Icon size={18} />
              </div>
              <div className="font-heading text-base font-bold text-brand-text">{opt.label}</div>
              <div className="font-body text-xs text-brand-text-secondary mt-0.5">{opt.desc}</div>
              {active && <CheckCircle2 size={16} className="text-brand-primary mt-2" />}
            </button>
          );
        })}
      </div>

      {fulfillment === "pickup" && (
        <div data-testid="pickup-info" className="mt-6 p-4 bg-brand-bg rounded-xl border border-brand-border">
          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-brand-primary mt-0.5" />
            <div>
              <div className="font-heading text-sm font-bold text-brand-text">The Culinary Editorial — Flagship</div>
              <div className="font-body text-xs text-brand-text-secondary mt-0.5">123 Epicurean Way, New York, NY 10013</div>
              <div className="font-body text-xs text-brand-text-secondary mt-1">Open today · 10:00 AM – 10:00 PM</div>
            </div>
          </div>
        </div>
      )}

      {fulfillment === "dine_in" && (
        <div className="mt-6">
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Table number</Label>
          <Input
            data-testid="dine-in-table-input"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            placeholder="e.g. 12"
            className="bg-brand-bg border-brand-border font-body text-sm h-12 max-w-xs"
          />
        </div>
      )}
    </div>
  );
}

function AddressStep({ address, setAddress, savedAddresses, isLoggedIn }) {
  return (
    <div data-testid="step-address">
      <h2 className="font-heading text-xl font-bold text-brand-text mb-1">Delivery address</h2>
      <p className="font-body text-sm text-brand-text-secondary mb-5">We'll bring your order here.</p>

      {isLoggedIn && savedAddresses.length > 0 && (
        <div data-testid="saved-addresses" className="mb-5">
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-2 block">Saved addresses</Label>
          <div className="flex flex-wrap gap-2">
            {savedAddresses.map((a, idx) => (
              <button
                key={idx}
                data-testid={`saved-address-${idx}`}
                onClick={() => setAddress(a)}
                className="px-3 py-2 rounded-lg border border-brand-border bg-brand-bg text-left hover:border-brand-primary/40 transition"
              >
                <div className="font-body text-xs font-semibold text-brand-text">{a.label || a.line1}</div>
                <div className="font-body text-[11px] text-brand-text-secondary truncate max-w-[240px]">{a.city}{a.postal_code ? `, ${a.postal_code}` : ""}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <AddressAutocomplete value={address} onChange={setAddress} />
    </div>
  );
}

function TimeStep({ slot, setSlot, fulfillment }) {
  return (
    <div data-testid="step-time">
      <h2 className="font-heading text-xl font-bold text-brand-text mb-1">When would you like it?</h2>
      <p className="font-body text-sm text-brand-text-secondary mb-5">
        {fulfillment === "delivery" ? "Pick a delivery time." : fulfillment === "pickup" ? "Pick a pickup time." : "Pick a seating time."}
      </p>
      <TimeSlotPicker value={slot} onChange={setSlot} />
    </div>
  );
}

function SummaryStep({
  items, pricing, contact, setContact, promoCode, setPromoCode, promoStatus,
  applyPromo, tip, setTip, tipMode, setTipMode, fulfillment, slot, address, tableNumber, isGuest,
}) {
  const setTipFromMode = (mode) => {
    setTipMode(mode);
    if (mode === "none") setTip(0);
    else if (mode === "custom") setTip(tip || 0);
    else setTip(+(pricing.sub * (parseInt(mode, 10) / 100)).toFixed(2));
  };

  return (
    <div data-testid="step-summary">
      <h2 className="font-heading text-xl font-bold text-brand-text mb-1">Review your order</h2>
      <p className="font-body text-sm text-brand-text-secondary mb-5">Check everything before you pay.</p>

      <div data-testid="summary-items" className="space-y-3 pb-4 border-b border-brand-border">
        {items.map((item) => (
          <div key={item.cartLineId} className="flex gap-3" data-testid={`summary-item-${item.cartLineId}`}>
            <img src={item.image} alt={item.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <span className="font-heading text-sm font-semibold text-brand-text">{item.name} <span className="font-body text-xs text-brand-text-secondary">× {item.qty}</span></span>
                <span className="font-heading text-sm font-semibold text-brand-text">${(item.price * item.qty).toFixed(2)}</span>
              </div>
              {item.variant && <div className="font-body text-[11px] text-brand-primary font-semibold">{item.variant.name}</div>}
              {item.modifiers?.length > 0 && (
                <div className="font-body text-[11px] text-brand-text-secondary mt-0.5">
                  {item.modifiers.map((m) => m.name).join(" · ")}
                </div>
              )}
              {item.instructions && <div className="font-body text-[11px] text-brand-text-secondary italic mt-0.5">Note: {item.instructions}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 rounded-xl bg-brand-bg border border-brand-border flex items-start gap-3">
        <Clock size={16} className="text-brand-primary mt-0.5" />
        <div className="flex-1 text-sm">
          <div className="font-heading font-semibold text-brand-text capitalize">{fulfillment.replace("_", "-")}</div>
          <div className="font-body text-xs text-brand-text-secondary">
            {slot === "ASAP" ? "As soon as possible" : slot}
            {fulfillment === "delivery" && address?.line1 ? ` · ${address.line1}, ${address.city || ""}` : ""}
            {fulfillment === "dine_in" && tableNumber ? ` · Table ${tableNumber}` : ""}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="font-heading text-sm font-bold text-brand-text mb-2">
          Contact {isGuest && <span className="font-body text-[10px] text-brand-text-secondary">(Guest checkout — we'll email your receipt)</span>}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Full name</Label>
            <Input
              data-testid="contact-name-input"
              value={contact.name}
              onChange={(e) => setContact({ ...contact, name: e.target.value })}
              placeholder="Jane Doe"
              className="bg-brand-bg border-brand-border h-11"
            />
          </div>
          <div>
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Email <span className="text-brand-primary">*</span></Label>
            <Input
              data-testid="contact-email-input"
              type="email"
              value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
              placeholder="you@example.com"
              className="bg-brand-bg border-brand-border h-11"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Phone</Label>
            <Input
              data-testid="contact-phone-input"
              type="tel"
              value={contact.phone}
              onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
              className="bg-brand-bg border-brand-border h-11"
            />
          </div>
        </div>
      </div>

      <div className="mt-5">
        <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5 flex items-center gap-1.5"><Tag size={12} /> Promo code</Label>
        <div className="flex gap-2">
          <Input
            data-testid="promo-input"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="SAVE10"
            className="bg-brand-bg border-brand-border h-11 flex-1"
          />
          <button
            data-testid="promo-apply-btn"
            onClick={applyPromo}
            className="px-4 py-2 bg-brand-text text-white font-body text-sm font-medium rounded-lg hover:bg-brand-text/90 transition-colors"
          >
            Apply
          </button>
        </div>
        {promoStatus.valid && (
          <p data-testid="promo-success" className="mt-1.5 text-xs text-green-700 font-body flex items-center gap-1"><CheckCircle2 size={12} /> {promoStatus.rule?.description}</p>
        )}
        {!promoStatus.valid && promoStatus.error && (
          <p data-testid="promo-error" className="mt-1.5 text-xs text-red-600 font-body">{promoStatus.error}</p>
        )}
      </div>

      <div className="mt-5">
        <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-2">Add a tip</Label>
        <div data-testid="tip-options" className="flex flex-wrap gap-2">
          {["none", "10", "15", "20", "custom"].map((m) => (
            <button
              key={m}
              data-testid={`tip-${m}`}
              onClick={() => setTipFromMode(m)}
              className={`px-4 py-2 rounded-full text-sm font-body font-medium border transition ${
                tipMode === m ? "bg-brand-primary text-white border-brand-primary" : "border-brand-border text-brand-text hover:border-brand-primary/40"
              }`}
            >
              {m === "none" ? "No tip" : m === "custom" ? "Custom" : `${m}%`}
            </button>
          ))}
        </div>
        {tipMode === "custom" && (
          <Input
            data-testid="tip-custom-input"
            type="number"
            min="0"
            step="0.5"
            value={tip}
            onChange={(e) => setTip(Math.max(0, Number(e.target.value) || 0))}
            className="bg-brand-bg border-brand-border h-11 max-w-[140px] mt-2"
            placeholder="$0.00"
          />
        )}
      </div>
    </div>
  );
}

function PaymentStep({ total, agreeTerms, setAgreeTerms, contact }) {
  return (
    <div data-testid="step-payment">
      <h2 className="font-heading text-xl font-bold text-brand-text mb-1">Payment</h2>
      <p className="font-body text-sm text-brand-text-secondary mb-5 inline-flex items-center gap-1.5"><Lock size={12} /> Secure checkout powered by Stripe</p>

      <div data-testid="payment-method-info" className="p-5 rounded-xl border-2 border-brand-primary bg-brand-primary/5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-primary text-white flex items-center justify-center flex-shrink-0">
          <CreditCard size={18} />
        </div>
        <div className="flex-1">
          <div className="font-heading font-bold text-brand-text">Card, Apple Pay, Google Pay</div>
          <div className="font-body text-xs text-brand-text-secondary mt-0.5">
            You'll be redirected to Stripe to complete your payment. All major cards, Apple Pay, and Google Pay are accepted.
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-body text-brand-text-secondary">
            <span className="px-2 py-1 border border-brand-border rounded bg-brand-surface">Visa</span>
            <span className="px-2 py-1 border border-brand-border rounded bg-brand-surface">Mastercard</span>
            <span className="px-2 py-1 border border-brand-border rounded bg-brand-surface">Amex</span>
            <span className="px-2 py-1 border border-brand-border rounded bg-brand-surface">Apple Pay</span>
            <span className="px-2 py-1 border border-brand-border rounded bg-brand-surface">Google Pay</span>
          </div>
        </div>
      </div>

      <div className="mt-5 p-4 rounded-xl bg-brand-bg border border-brand-border">
        <div className="flex items-center justify-between">
          <span className="font-body text-sm text-brand-text-secondary">Amount to pay</span>
          <span data-testid="payment-total" className="font-heading text-2xl font-bold text-brand-text">${total.toFixed(2)}</span>
        </div>
        <div className="mt-1 font-body text-xs text-brand-text-secondary">Receipt will be sent to {contact.email || "your email"}</div>
      </div>

      <label className="mt-5 flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreeTerms}
          onChange={(e) => setAgreeTerms(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-brand-border accent-brand-primary"
          data-testid="agree-terms-checkbox"
        />
        <span className="font-body text-xs text-brand-text-secondary">
          I agree to the <span className="underline">Terms of Service</span> and <span className="underline">Privacy Policy</span>. I understand this is a test environment — no real charge will be made.
        </span>
      </label>
    </div>
  );
}

function OrderSummaryCard({ items, pricing, fulfillment, slot }) {
  return (
    <div className="lg:col-span-2 mt-6 lg:mt-0">
      <div
        data-testid="order-summary-card"
        className="bg-brand-surface border border-brand-border rounded-2xl p-5 lg:sticky lg:top-20"
      >
        <h3 className="font-heading text-base font-bold text-brand-text mb-4">Order summary</h3>
        <div className="space-y-3 pb-3 border-b border-brand-border max-h-60 overflow-y-auto">
          {items.map((i) => (
            <div key={i.cartLineId} className="flex items-start gap-3 text-sm">
              <span className="font-body text-xs w-6 text-brand-text-secondary">×{i.qty}</span>
              <div className="flex-1 font-body text-xs text-brand-text">
                {i.name}
                {i.variant && <span className="block text-[11px] text-brand-primary">{i.variant.name}</span>}
              </div>
              <span className="font-body text-xs text-brand-text">${(i.price * i.qty).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2 py-3 border-b border-brand-border text-sm font-body">
          <Row label="Subtotal" value={`$${pricing.sub.toFixed(2)}`} testid="summary-subtotal" />
          {pricing.discount > 0 && <Row label="Discount" value={`−$${pricing.discount.toFixed(2)}`} testid="summary-discount" className="text-green-700" />}
          {fulfillment === "delivery" && <Row label="Delivery fee" value={`$${pricing.deliveryFee.toFixed(2)}`} testid="summary-delivery" />}
          <Row label="Tax" value={`$${pricing.tax.toFixed(2)}`} testid="summary-tax" />
        </div>
        <div className="flex items-center justify-between pt-3 font-heading">
          <span className="text-base font-bold text-brand-text">Total</span>
          <span data-testid="summary-total" className="text-2xl font-bold text-brand-text">${pricing.total.toFixed(2)}</span>
        </div>
        <div className="mt-2 font-body text-[11px] text-brand-text-secondary">
          {slot === "ASAP" ? `Arriving ${fulfillment === "delivery" ? "in ~30 min" : "in ~20 min"}` : `Scheduled · ${slot}`}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, testid, className = "" }) {
  return (
    <div data-testid={testid} className={`flex items-center justify-between text-brand-text-secondary ${className}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
