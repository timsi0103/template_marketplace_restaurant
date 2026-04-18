import { useState, useEffect, useMemo } from "react";
import { CreditCard, Lock, Trash2, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Card brand detection ────────────────────────────────
const BRAND_PATTERNS = [
  { brand: "amex", re: /^3[47]/, label: "American Express", maxLen: 15, cvvLen: 4, groups: [4, 6, 5] },
  { brand: "visa", re: /^4/, label: "Visa", maxLen: 16, cvvLen: 3, groups: [4, 4, 4, 4] },
  { brand: "mastercard", re: /^(5[1-5]|2[2-7])/, label: "Mastercard", maxLen: 16, cvvLen: 3, groups: [4, 4, 4, 4] },
  { brand: "discover", re: /^(6011|65|64[4-9])/, label: "Discover", maxLen: 16, cvvLen: 3, groups: [4, 4, 4, 4] },
  { brand: "diners", re: /^(36|30[0-5]|3095|38|39)/, label: "Diners Club", maxLen: 14, cvvLen: 3, groups: [4, 6, 4] },
  { brand: "jcb", re: /^35(2[89]|[3-8])/, label: "JCB", maxLen: 16, cvvLen: 3, groups: [4, 4, 4, 4] },
];

function detectBrand(number) {
  const digits = number.replace(/\D/g, "");
  for (const b of BRAND_PATTERNS) if (b.re.test(digits)) return b;
  return null;
}

function formatCardNumber(value, brand) {
  const digits = value.replace(/\D/g, "").slice(0, brand?.maxLen || 16);
  const groups = brand?.groups || [4, 4, 4, 4];
  const out = [];
  let cursor = 0;
  for (const g of groups) {
    if (cursor >= digits.length) break;
    out.push(digits.slice(cursor, cursor + g));
    cursor += g;
  }
  return out.join(" ");
}

function luhnCheck(num) {
  const s = num.replace(/\D/g, "");
  if (s.length < 12) return false;
  let sum = 0;
  let alt = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let n = parseInt(s[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

// ─── Payment method option logos (inline SVG/brand colors) ──
const METHODS = [
  { key: "card", label: "Credit / Debit Card", desc: "Visa, Mastercard, Amex, Discover" },
  { key: "apple_pay", label: "Apple Pay", desc: "Fast & secure" },
  { key: "google_pay", label: "Google Pay", desc: "Fast & secure" },
  { key: "paypal", label: "PayPal", desc: "Pay with your PayPal balance" },
];

function MethodLogo({ method }) {
  if (method === "card") return (
    <div className="flex items-center gap-1">
      <BrandLogo brand="visa" size="sm" />
      <BrandLogo brand="mastercard" size="sm" />
      <BrandLogo brand="amex" size="sm" />
    </div>
  );
  if (method === "apple_pay") return (
    <div className="w-12 h-8 bg-black text-white rounded flex items-center justify-center">
      <span className="font-semibold text-xs tracking-tight"> Pay</span>
    </div>
  );
  if (method === "google_pay") return (
    <div className="w-12 h-8 bg-white border border-brand-border rounded flex items-center justify-center gap-0.5 text-[10px] font-bold">
      <span style={{ color: "#4285F4" }}>G</span>
      <span style={{ color: "#EA4335" }}>o</span>
      <span style={{ color: "#FBBC04" }}>o</span>
      <span style={{ color: "#4285F4" }}>g</span>
      <span style={{ color: "#34A853" }}>l</span>
      <span style={{ color: "#EA4335" }}>e</span>
      <span className="text-brand-text ml-0.5">Pay</span>
    </div>
  );
  if (method === "paypal") return (
    <div className="w-12 h-8 bg-[#003087] text-white rounded flex items-center justify-center">
      <span className="font-bold text-xs italic tracking-tight">Pay<span className="text-[#009CDE]">Pal</span></span>
    </div>
  );
  return null;
}

function BrandLogo({ brand, size = "md" }) {
  const h = size === "sm" ? "h-6" : "h-8";
  const common = `${h} px-1.5 rounded border border-brand-border bg-white flex items-center justify-center text-[10px] font-bold tracking-tighter`;
  switch (brand) {
    case "visa":
      return <div className={`${common}`} style={{ color: "#1A1F71" }}><span className="italic">VISA</span></div>;
    case "mastercard":
      return (
        <div className={`${common}`} title="Mastercard">
          <span className="relative inline-block w-8 h-5">
            <span className="absolute left-0 top-0 w-5 h-5 rounded-full" style={{ background: "#EB001B" }} />
            <span className="absolute right-0 top-0 w-5 h-5 rounded-full opacity-90" style={{ background: "#F79E1B", mixBlendMode: "multiply" }} />
          </span>
        </div>
      );
    case "amex":
      return <div className={`${common}`} style={{ background: "#2E77BC", color: "white", borderColor: "#2E77BC" }}>AMEX</div>;
    case "discover":
      return <div className={`${common}`} style={{ background: "#F7931E", color: "white", borderColor: "#F7931E" }}>DISC</div>;
    case "diners":
      return <div className={`${common}`} style={{ color: "#0079BE" }}>DINERS</div>;
    case "jcb":
      return <div className={`${common}`} style={{ color: "#0E4C96" }}>JCB</div>;
    default:
      return <div className={`${common}`}>CARD</div>;
  }
}

export default function PaymentMethodSelector({
  total,
  method, setMethod,
  savedCardId, setSavedCardId,
  agreeTerms, setAgreeTerms,
  cardForm, setCardForm,
  isLoggedIn,
  contactEmail,
}) {
  const [savedCards, setSavedCards] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoadingSaved(true);
    fetch("/api/payment-methods", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setSavedCards(data.payment_methods || []))
      .catch(() => setSavedCards([]))
      .finally(() => setLoadingSaved(false));
  }, [isLoggedIn]);

  useEffect(() => {
    if (method === "card" && isLoggedIn && savedCards.length === 0) setShowCardForm(true);
    if (method === "card" && !isLoggedIn) setShowCardForm(true);
    if (method !== "card") setShowCardForm(false);
  }, [method, isLoggedIn, savedCards.length]);

  const deleteCard = async (id) => {
    try {
      const res = await fetch(`/api/payment-methods/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("delete failed");
      setSavedCards((list) => list.filter((c) => c.id !== id));
      if (savedCardId === id) setSavedCardId(null);
      toast.success("Card removed");
    } catch {
      toast.error("Could not remove card");
    }
  };

  return (
    <div data-testid="payment-method-selector">
      {/* Method grid */}
      <h3 className="font-heading text-sm font-bold text-brand-text mb-3">Select a payment method</h3>
      <div data-testid="payment-methods-grid" className="grid grid-cols-2 gap-3">
        {METHODS.map((m) => {
          const active = method === m.key;
          return (
            <button
              key={m.key}
              data-testid={`pay-method-${m.key}`}
              onClick={() => setMethod(m.key)}
              className={`p-4 rounded-xl border-2 text-left transition active:scale-[0.98] ${
                active
                  ? "border-brand-primary bg-brand-primary/5 shadow-sm"
                  : "border-brand-border bg-brand-bg hover:border-brand-primary/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <MethodLogo method={m.key} />
                {active && <CheckCircle2 size={16} className="text-brand-primary flex-shrink-0" />}
              </div>
              <div className="font-heading text-sm font-bold text-brand-text">{m.label}</div>
              <div className="font-body text-[11px] text-brand-text-secondary mt-0.5">{m.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Card method — saved cards + form */}
      {method === "card" && (
        <div data-testid="card-section" className="mt-5 space-y-4">
          {isLoggedIn && (
            <div data-testid="saved-cards" className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">Saved cards</Label>
                {loadingSaved && <span className="text-[10px] text-brand-text-secondary">Loading…</span>}
              </div>
              {savedCards.length === 0 && !loadingSaved && (
                <p data-testid="no-saved-cards" className="font-body text-xs text-brand-text-secondary italic">
                  No saved cards yet. After your first paid order, we'll remember your card for next time.
                </p>
              )}
              {savedCards.map((c) => {
                const active = savedCardId === c.id;
                return (
                  <div
                    key={c.id}
                    data-testid={`saved-card-${c.id}`}
                    onClick={() => { setSavedCardId(c.id); setShowCardForm(false); }}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                      active ? "border-brand-primary bg-brand-primary/5" : "border-brand-border bg-brand-bg hover:border-brand-primary/30"
                    }`}
                  >
                    <BrandLogo brand={c.brand} />
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-sm font-semibold text-brand-text">
                        •••• •••• •••• {c.last4}
                      </div>
                      <div className="font-body text-[11px] text-brand-text-secondary">
                        {c.cardholder_name ? `${c.cardholder_name} · ` : ""}Exp {String(c.exp_month).padStart(2, "0")}/{String(c.exp_year).slice(-2)}
                      </div>
                    </div>
                    {active && <CheckCircle2 size={16} className="text-brand-primary" />}
                    <button
                      data-testid={`delete-card-${c.id}`}
                      onClick={(e) => { e.stopPropagation(); deleteCard(c.id); }}
                      className="p-1.5 rounded-full text-brand-text-secondary hover:bg-red-50 hover:text-red-500 transition"
                      aria-label="Delete card"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
              <button
                data-testid="add-new-card-btn"
                onClick={() => { setShowCardForm((v) => !v); setSavedCardId(null); }}
                className="w-full flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-brand-border bg-brand-bg text-brand-text-secondary hover:text-brand-primary hover:border-brand-primary/40 transition"
              >
                <Plus size={16} />
                <span className="font-body text-xs font-semibold">{showCardForm ? "Cancel" : "Add new card"}</span>
              </button>
            </div>
          )}

          {showCardForm && <MockCardForm cardForm={cardForm} setCardForm={setCardForm} />}
        </div>
      )}

      {/* Non-card methods info */}
      {method !== "card" && (
        <div data-testid="non-card-info" className="mt-5 p-4 rounded-xl bg-brand-bg border border-brand-border flex items-start gap-3">
          <Lock size={16} className="text-brand-primary mt-0.5" />
          <div className="text-sm">
            <div className="font-heading font-semibold text-brand-text">You'll complete payment with {METHODS.find((x) => x.key === method)?.label}</div>
            <div className="font-body text-xs text-brand-text-secondary mt-0.5">
              You'll be redirected to Stripe, where {METHODS.find((x) => x.key === method)?.label} is available as a payment option.
            </div>
          </div>
        </div>
      )}

      {/* Total + terms */}
      <div className="mt-5 p-4 rounded-xl bg-brand-bg border border-brand-border">
        <div className="flex items-center justify-between">
          <span className="font-body text-sm text-brand-text-secondary">Amount to pay</span>
          <span data-testid="payment-total" className="font-heading text-2xl font-bold text-brand-text">${total.toFixed(2)}</span>
        </div>
        <div className="mt-1 font-body text-xs text-brand-text-secondary">
          Receipt will be sent to {contactEmail || "your email"}
        </div>
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
          I agree to the <span className="underline">Terms of Service</span> and <span className="underline">Privacy Policy</span>. Secure checkout powered by <span className="font-semibold">Stripe</span>.
        </span>
      </label>
    </div>
  );
}

// ─── On-page mock card form ──────────────────────────────
function MockCardForm({ cardForm, setCardForm }) {
  const brand = useMemo(() => detectBrand(cardForm.number), [cardForm.number]);
  const formattedNumber = useMemo(() => formatCardNumber(cardForm.number, brand), [cardForm.number, brand]);

  const numberError = useMemo(() => {
    const digits = cardForm.number.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length < (brand?.maxLen || 16)) return "";
    if (!luhnCheck(digits)) return "Invalid card number";
    return "";
  }, [cardForm.number, brand]);

  const expiryError = useMemo(() => {
    if (!cardForm.expiry) return "";
    const m = cardForm.expiry.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return cardForm.expiry.length === 5 ? "Use MM/YY" : "";
    const mm = parseInt(m[1], 10);
    const yy = parseInt(m[2], 10);
    if (mm < 1 || mm > 12) return "Invalid month";
    const now = new Date();
    const expDate = new Date(2000 + yy, mm, 0);
    if (expDate < now) return "Card is expired";
    return "";
  }, [cardForm.expiry]);

  const cvvError = useMemo(() => {
    if (!cardForm.cvv) return "";
    const cvvLen = brand?.cvvLen || 3;
    return cardForm.cvv.length < cvvLen ? `CVV must be ${cvvLen} digits` : "";
  }, [cardForm.cvv, brand]);

  const onNumberChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 19);
    setCardForm({ ...cardForm, number: raw });
  };

  const onExpiryChange = (e) => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
    setCardForm({ ...cardForm, expiry: v });
  };

  const onCvvChange = (e) => {
    const max = brand?.cvvLen || 4;
    const v = e.target.value.replace(/\D/g, "").slice(0, max);
    setCardForm({ ...cardForm, cvv: v });
  };

  return (
    <div data-testid="card-form" className="space-y-4 p-5 rounded-xl border-2 border-brand-primary/30 bg-brand-surface relative">
      <div className="flex items-center gap-2">
        <CreditCard size={14} className="text-brand-primary" />
        <span className="font-body text-[10px] uppercase tracking-widest font-semibold text-brand-text">Card details</span>
        <span className="ml-auto text-[10px] font-body text-brand-text-secondary inline-flex items-center gap-1">
          <Lock size={10} /> Demo form — actual payment on Stripe
        </span>
      </div>

      {/* Card number */}
      <div>
        <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Card number</Label>
        <div className="relative">
          <Input
            data-testid="card-number-input"
            value={formattedNumber}
            onChange={onNumberChange}
            placeholder="1234 5678 9012 3456"
            inputMode="numeric"
            autoComplete="cc-number"
            className={`bg-brand-bg border-brand-border h-12 pr-24 font-mono tracking-wider text-base ${
              numberError ? "border-red-400" : ""
            }`}
          />
          <div data-testid="card-brand-indicator" className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {brand ? <BrandLogo brand={brand.brand} size="sm" /> : <CreditCard size={16} className="text-brand-text-secondary/50" />}
          </div>
        </div>
        {numberError && <p data-testid="card-number-error" className="mt-1 text-xs text-red-600 font-body inline-flex items-center gap-1"><AlertCircle size={11} /> {numberError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Expiry (MM/YY)</Label>
          <Input
            data-testid="card-expiry-input"
            value={cardForm.expiry}
            onChange={onExpiryChange}
            placeholder="12/28"
            inputMode="numeric"
            autoComplete="cc-exp"
            className={`bg-brand-bg border-brand-border h-12 font-mono tracking-wider ${expiryError ? "border-red-400" : ""}`}
          />
          {expiryError && <p data-testid="card-expiry-error" className="mt-1 text-xs text-red-600 font-body">{expiryError}</p>}
        </div>
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">
            CVV {brand && <span className="normal-case text-brand-text-secondary">({brand.cvvLen} digits)</span>}
          </Label>
          <Input
            data-testid="card-cvv-input"
            type="password"
            value={cardForm.cvv}
            onChange={onCvvChange}
            placeholder="•••"
            inputMode="numeric"
            autoComplete="cc-csc"
            className={`bg-brand-bg border-brand-border h-12 font-mono tracking-wider ${cvvError ? "border-red-400" : ""}`}
          />
          {cvvError && <p data-testid="card-cvv-error" className="mt-1 text-xs text-red-600 font-body">{cvvError}</p>}
        </div>
      </div>

      <div>
        <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Cardholder name</Label>
        <Input
          data-testid="card-name-input"
          value={cardForm.name}
          onChange={(e) => setCardForm({ ...cardForm, name: e.target.value.toUpperCase() })}
          placeholder="JANE DOE"
          autoComplete="cc-name"
          className="bg-brand-bg border-brand-border h-12 font-mono tracking-wider uppercase"
        />
      </div>

      <p className="font-body text-[10px] text-brand-text-secondary flex items-start gap-1.5">
        <Lock size={10} className="mt-0.5 flex-shrink-0" />
        On "Pay", you'll be securely redirected to Stripe to finalize the charge. Your card details entered here are not submitted anywhere.
      </p>
    </div>
  );
}

export function cardFormIsValid(method, savedCardId, cardForm) {
  if (method !== "card") return true;
  if (savedCardId) return true;
  const digits = cardForm.number.replace(/\D/g, "");
  const brand = detectBrand(cardForm.number);
  if (digits.length < (brand?.maxLen || 16)) return false;
  if (!luhnCheck(digits)) return false;
  const m = cardForm.expiry.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const mm = parseInt(m[1], 10);
  const yy = parseInt(m[2], 10);
  if (mm < 1 || mm > 12) return false;
  const expDate = new Date(2000 + yy, mm, 0);
  if (expDate < new Date()) return false;
  const cvvLen = brand?.cvvLen || 3;
  if (cardForm.cvv.length < cvvLen) return false;
  if (!cardForm.name.trim()) return false;
  return true;
}
