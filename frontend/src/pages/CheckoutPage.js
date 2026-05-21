import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, ArrowRight, Truck, Store, Utensils, MapPin, Clock,
  CreditCard, Lock, Tag, CheckCircle2, AlertCircle, Loader2, X,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import AddressAutocomplete from "@/components/checkout/AddressAutocomplete";
import TimeSlotPicker from "@/components/checkout/TimeSlotPicker";
import CheckoutStepper from "@/components/checkout/CheckoutStepper";
import PaymentMethodSelector, { cardFormIsValid } from "@/components/checkout/PaymentMethodSelector";
import GuestCheckoutChoice from "@/components/checkout/GuestCheckoutChoice";
import ReturningGuestHint from "@/components/checkout/ReturningGuestHint";

const STEPS = [
  { key: "fulfillment", label: "Fulfillment" },
  { key: "address", label: "Address" },
  { key: "time", label: "Time" },
  { key: "summary", label: "Summary" },
  { key: "payment", label: "Payment" },
];

const TAX_RATE = 0.0875;
const DELIVERY_FEE = 4.99;
const API = "/api";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, subtotal, clearCart, promo: cartPromo, applyPromoCode: applyPromoViaCart, clearPromo: clearPromoFromCart } = useCart();
  const [searchParams] = useSearchParams();

  const [stepIdx, setStepIdx] = useState(0);
  const [fulfillment, setFulfillment] = useState("delivery");
  const [address, setAddress] = useState({ label: "", line1: "", line2: "", city: "", postal_code: "", lat: null, lng: null, notes: "" });
  const [savedAddresses] = useState(() => {
    try { return JSON.parse(localStorage.getItem("saved_addresses") || "[]"); } catch { return []; }
  });
  const [tableNumber, setTableNumber] = useState("");
  const [slot, setSlot] = useState("ASAP");
  const [eta, setEta] = useState(null);
  const [tip, setTip] = useState(0);
  const [tipMode, setTipMode] = useState("none");
  const [promoCode, setPromoCode] = useState(cartPromo?.code || "");
  const [promoStatus, setPromoStatus] = useState(
    cartPromo?.rule ? { valid: true, rule: cartPromo.rule, error: "" } : { valid: false, rule: null, error: "" }
  );
  const [promoLoading, setPromoLoading] = useState(false);
  const [contact, setContact] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
  });
  const [placing, setPlacing] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [payMethod, setPayMethod] = useState("card");
  const [savedCardId, setSavedCardId] = useState(null);
  const [cardForm, setCardForm] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [guestChoiceDismissed, setGuestChoiceDismissed] = useState(() => {
    try { return localStorage.getItem("guest_choice_dismissed_v1") === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (user?.email && !contact.email) {
      setContact((c) => ({ ...c, email: user.email, name: user.name || c.name }));
    }
    // eslint-disable-next-line
  }, [user]);

  useEffect(() => {
    // Fetch live ETA based on current cart categories/items
    const itemIds = items.map((i) => i.id || i.item_id).filter(Boolean);
    const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));
    if (itemIds.length === 0 && categories.length === 0) { setEta(null); return; }
    axios.post(`${API}/store/eta`, { item_ids: itemIds, categories })
      .then(({ data }) => setEta(data))
      .catch(() => setEta(null));
  }, [items]);

  useEffect(() => {
    if (eta && !eta.asap_available && slot === "ASAP") {
      setSlot(eta.next_available_slot || "ASAP");
    }
  }, [eta]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchParams.get("cancelled") === "1") {
      toast.error("Payment cancelled", { description: "Your order was not placed." });
    }
  }, [searchParams]);

  const pricing = useMemo(() => {
    const sub = subtotal;
    const deliveryFee = fulfillment === "delivery" ? DELIVERY_FEE : 0;
    let discount = 0;
    let isFreeDelivery = false;
    if (promoStatus.valid && promoStatus.rule) {
      const r = promoStatus.rule;
      if (r.type === "percent") discount = sub * (r.value / 100);
      else if (r.type === "fixed") discount = r.value;
      else if (r.type === "free_delivery") {
        discount = deliveryFee;
        isFreeDelivery = true;
      }
    }
    const taxable = Math.max(0, sub - discount);
    const tax = taxable * TAX_RATE;
    const total = Math.max(0, sub - discount + deliveryFee + tax + Number(tip || 0));
    return { sub, deliveryFee, discount, tax, total, isFreeDelivery };
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
        if (!agreeTerms) return false;
        return cardFormIsValid(payMethod, savedCardId, cardForm);
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
    if (!promoCode.trim() || promoLoading) return;
    setPromoLoading(true);
    try {
      const res = await fetch("/api/orders/validate-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promoCode.trim(),
          subtotal,
          contact_email: contact.email || null,
          fulfillment_type: fulfillment,
        }),
      });
      const data = await res.json();
      if (data.valid) {
        setPromoStatus({ valid: true, rule: data.rule, error: "" });
        try {
          localStorage.setItem("culinary_promo", JSON.stringify({ code: data.code, rule: data.rule }));
          // keep cart context in sync if it tracks promo
          applyPromoViaCart(promoCode.trim());
        } catch { /* noop */ }
        toast.success("Promo applied", { description: data.description });
      } else {
        setPromoStatus({ valid: false, rule: null, error: data.error || "Invalid code" });
        toast.error(data.error || "Invalid promo code");
      }
    } catch {
      toast.error("Could not validate promo code");
      setPromoStatus({ valid: false, rule: null, error: "Network error" });
    } finally {
      setPromoLoading(false);
    }
  };

  const clearPromo = () => {
    setPromoCode("");
    setPromoStatus({ valid: false, rule: null, error: "" });
    clearPromoFromCart();
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

        {(!user?.email || user?.guest) && (
          <GuestCheckoutChoice
            email={contact.email}
            dismissed={guestChoiceDismissed}
            onContinueAsGuest={() => {
              setGuestChoiceDismissed(true);
              try { localStorage.setItem("guest_choice_dismissed_v1", "1"); } catch { /* ignore */ }
            }}
            onDismiss={() => {
              setGuestChoiceDismissed(true);
              try { localStorage.setItem("guest_choice_dismissed_v1", "1"); } catch { /* ignore */ }
            }}
          />
        )}

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
                clearPromo={clearPromo}
                promoLoading={promoLoading}
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
                contactEmail={contact.email}
                payMethod={payMethod}
                setPayMethod={setPayMethod}
                savedCardId={savedCardId}
                setSavedCardId={setSavedCardId}
                cardForm={cardForm}
                setCardForm={setCardForm}
                isLoggedIn={!!user?.email && !user?.guest}
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

          <OrderSummaryCard
            items={items}
            pricing={pricing}
            fulfillment={fulfillment}
            slot={slot}
            eta={eta}
            promoCode={promoCode}
            setPromoCode={setPromoCode}
            promoStatus={promoStatus}
            applyPromo={applyPromo}
          />
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
  applyPromo, clearPromo, promoLoading, tip, setTip, tipMode, setTipMode,
  fulfillment, slot, address, tableNumber, isGuest,
}) {
  const [availableCoupons, setAvailableCoupons] = useState([]);

  useEffect(() => {
    fetch(`/api/coupons/active?subtotal=${pricing.sub}&fulfillment_type=${fulfillment}`)
      .then((r) => r.json())
      .then((d) => setAvailableCoupons(d.coupons || []))
      .catch(() => setAvailableCoupons([]));
  }, [pricing.sub, fulfillment]);

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
            {isGuest && <ReturningGuestHint email={contact.email} />}
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
        {promoStatus.valid ? (
          <div data-testid="promo-applied" className="flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-green-300 bg-green-50">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-body text-sm font-semibold text-green-800 truncate">{promoCode.toUpperCase()}</div>
                <div className="font-body text-[11px] text-green-700 truncate">{promoStatus.rule?.description}</div>
              </div>
            </div>
            <button
              data-testid="promo-clear-btn"
              onClick={clearPromo}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-green-300 bg-white text-green-700 hover:bg-green-100 font-body text-xs font-semibold transition"
              aria-label="Remove promo code"
            >
              <X size={12} /> Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                data-testid="promo-input"
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); if (promoStatus.error) { /* clear error on edit */ } }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } }}
                placeholder="SAVE10"
                disabled={promoLoading}
                className={`bg-brand-bg border-brand-border h-11 pr-9 uppercase tracking-wider font-mono ${
                  promoStatus.error ? "border-red-400" : ""
                }`}
              />
              {promoLoading && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-brand-primary" />
              )}
            </div>
            <button
              data-testid="promo-apply-btn"
              onClick={applyPromo}
              disabled={promoLoading || !promoCode.trim()}
              className="px-4 py-2 bg-brand-text text-white font-body text-sm font-medium rounded-lg hover:bg-brand-text/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5"
            >
              {promoLoading ? <Loader2 size={14} className="animate-spin" /> : null}
              Apply
            </button>
          </div>
        )}
        {!promoStatus.valid && promoStatus.error && (
          <p data-testid="promo-error" className="mt-1.5 text-xs text-red-600 font-body inline-flex items-center gap-1">
            <AlertCircle size={11} /> {promoStatus.error}
          </p>
        )}

        {/* Available coupons */}
        {!promoStatus.valid && availableCoupons.length > 0 && (
          <div data-testid="available-coupons" className="mt-3">
            <div className="text-[10px] uppercase tracking-widest text-brand-text-secondary font-semibold mb-2">Available coupons</div>
            <div className="flex flex-wrap gap-2">
              {availableCoupons.map((c) => {
                const valueLabel = c.type === "percent" ? `${c.value}% off`
                  : c.type === "fixed" ? `$${c.value.toFixed(2)} off`
                  : "Free delivery";
                const disabled = !c.applies_now;
                return (
                  <button
                    key={c.code}
                    type="button"
                    data-testid={`coupon-${c.code}`}
                    disabled={disabled}
                    onClick={() => { setPromoCode(c.code); setTimeout(applyPromo, 0); }}
                    className={`text-left px-3 py-2 rounded-xl border transition ${disabled
                      ? "border-dashed border-brand-border bg-brand-bg/50 text-brand-text-secondary opacity-70 cursor-not-allowed"
                      : "border-brand-border bg-brand-surface hover:border-brand-primary/50 hover:bg-brand-bg"
                    }`}
                  >
                    <div className="font-mono text-xs font-bold tracking-wider text-brand-text">{c.code}</div>
                    <div className="text-[11px] text-brand-text-secondary">{valueLabel} · {c.description}</div>
                    {disabled && c.min_subtotal > pricing.sub && (
                      <div className="text-[10px] text-amber-700 mt-0.5">Spend ${(c.min_subtotal - pricing.sub).toFixed(2)} more</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
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

function PaymentStep({
  total, agreeTerms, setAgreeTerms, contactEmail,
  payMethod, setPayMethod, savedCardId, setSavedCardId,
  cardForm, setCardForm, isLoggedIn,
}) {
  return (
    <div data-testid="step-payment">
      <h2 className="font-heading text-xl font-bold text-brand-text mb-1">Payment</h2>
      <p className="font-body text-sm text-brand-text-secondary mb-5 inline-flex items-center gap-1.5"><Lock size={12} /> Secure checkout powered by Stripe</p>
      <PaymentMethodSelector
        total={total}
        method={payMethod}
        setMethod={setPayMethod}
        savedCardId={savedCardId}
        setSavedCardId={setSavedCardId}
        cardForm={cardForm}
        setCardForm={setCardForm}
        agreeTerms={agreeTerms}
        setAgreeTerms={setAgreeTerms}
        isLoggedIn={isLoggedIn}
        contactEmail={contactEmail}
      />
    </div>
  );
}

function OrderSummaryCard({ items, pricing, fulfillment, slot, eta, promoCode, setPromoCode, promoStatus, applyPromo }) {
  const [availableCoupons, setAvailableCoupons] = useState([]);
  useEffect(() => {
    fetch(`/api/coupons/active?subtotal=${pricing.sub}&fulfillment_type=${fulfillment}`)
      .then((r) => r.json())
      .then((d) => setAvailableCoupons(d.coupons || []))
      .catch(() => setAvailableCoupons([]));
  }, [pricing.sub, fulfillment]);

  return (
    <div className="lg:col-span-2 mt-6 lg:mt-0 space-y-4">
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
          {pricing.discount > 0 && !pricing.isFreeDelivery && (
            <Row label="Discount" value={`−$${pricing.discount.toFixed(2)}`} testid="summary-discount" className="text-green-700" />
          )}
          {fulfillment === "delivery" && (
            pricing.isFreeDelivery ? (
              <div data-testid="summary-free-delivery" className="flex items-center justify-between text-brand-text-secondary">
                <span>Delivery fee</span>
                <span className="inline-flex items-center gap-2">
                  <span className="line-through text-brand-text-secondary/60">${pricing.deliveryFee.toFixed(2)}</span>
                  <span data-testid="summary-delivery-free" className="font-semibold text-green-700">FREE</span>
                </span>
              </div>
            ) : (
              <Row label="Delivery fee" value={`$${pricing.deliveryFee.toFixed(2)}`} testid="summary-delivery" />
            )
          )}
          <Row label="Tax" value={`$${pricing.tax.toFixed(2)}`} testid="summary-tax" />
        </div>
        <div className="flex items-center justify-between pt-3 font-heading">
          <span className="text-base font-bold text-brand-text">Total</span>
          <span data-testid="summary-total" className="text-2xl font-bold text-brand-text">${pricing.total.toFixed(2)}</span>
        </div>
        <div className="mt-2 font-body text-[11px] text-brand-text-secondary" data-testid="summary-eta">
          {eta && !eta.asap_available && eta.next_available_slot ? (
            <span className="text-amber-700 font-semibold">Next available slot: {new Date(eta.next_available_slot).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
          ) : eta && eta.asap_available ? (
            eta.eta_label
          ) : (
            slot === "ASAP" ? `Arriving ${fulfillment === "delivery" ? "in ~30 min" : "in ~20 min"}` : `Scheduled · ${slot}`
          )}
        </div>

        {/* Available coupons — visible on every checkout step */}
        {availableCoupons.length > 0 && !promoStatus?.valid && (
          <div data-testid="summary-available-coupons" className="mt-4 pt-4 border-t border-brand-border">
            <div className="text-[10px] uppercase tracking-widest text-brand-text-secondary font-semibold mb-2">
              Available coupons
            </div>
            <div className="flex flex-col gap-2">
              {availableCoupons.map((c) => {
                const valueLabel = c.type === "percent" ? `${c.value}% off`
                  : c.type === "fixed" ? `$${c.value.toFixed(2)} off`
                  : "Free delivery";
                const disabled = !c.applies_now;
                return (
                  <button
                    key={c.code}
                    type="button"
                    data-testid={`summary-coupon-${c.code}`}
                    disabled={disabled}
                    onClick={() => { setPromoCode?.(c.code); setTimeout(() => applyPromo?.(), 0); }}
                    className={`text-left px-3 py-2 rounded-xl border transition ${disabled
                      ? "border-dashed border-brand-border bg-brand-bg/40 text-brand-text-secondary opacity-70 cursor-not-allowed"
                      : "border-brand-border bg-brand-bg hover:border-brand-primary/50 hover:bg-brand-surface"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold tracking-wider text-brand-text">{c.code}</span>
                      <span className="text-[10px] font-body font-semibold text-brand-primary">{valueLabel}</span>
                    </div>
                    <div className="text-[10px] text-brand-text-secondary mt-0.5 leading-snug">{c.description}</div>
                    {disabled && c.min_subtotal > pricing.sub && (
                      <div className="text-[10px] text-amber-700 mt-0.5">Spend ${(c.min_subtotal - pricing.sub).toFixed(2)} more to unlock</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
