import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Minus, Plus, CreditCard, CirclePlus } from "lucide-react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { useCart } from "@/contexts/CartContext";

export default function CheckoutPage() {
  const [deliveryMethod, setDeliveryMethod] = useState("delivery");
  const { items, subtotal, updateQty } = useCart();

  const displayItems = items.length > 0
    ? items
    : [
        { id: 1, name: "Heirloom Grain Bowl", description: "Quinoa, Roasted Beet, Citrus Vinaigrette", price: 18, qty: 1, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=120&h=120&fit=crop" },
        { id: 2, name: "Burrata Tartine", description: "Sourdough, Blistered Tomato, Basil", price: 24, qty: 2, image: "https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=120&h=120&fit=crop" },
      ];

  const calcSubtotal = items.length > 0 ? subtotal : displayItems.reduce((s, i) => s + i.price * i.qty, 0);
  const taxes = calcSubtotal * 0.0875;
  const deliveryFee = deliveryMethod === "delivery" ? 4.99 : 0;
  const total = calcSubtotal + taxes + deliveryFee;

  return (
    <div data-testid="checkout-page" className="min-h-screen bg-brand-bg pb-0 md:pb-0">
      {/* Top bar */}
      <div className="border-b border-brand-border bg-brand-bg sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <Link
            to="/menu"
            data-testid="checkout-back-btn"
            className="text-brand-text hover:text-brand-primary active:text-brand-primary transition-colors p-1"
          >
            <ArrowLeft size={20} />
          </Link>
          <span className="font-heading text-lg sm:text-xl font-semibold text-brand-primary">
            The Culinary Editorial
          </span>
          <div className="w-5" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 lg:py-12">
        {/* On mobile: order summary first (above form), on desktop: side by side */}
        <div className="flex flex-col-reverse lg:grid lg:grid-cols-5 lg:gap-10">
          {/* Left: Form */}
          <div className="lg:col-span-3 mt-6 lg:mt-0">
            <h1
              data-testid="checkout-title"
              className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-brand-text tracking-tight mb-6 sm:mb-8"
            >
              Checkout
            </h1>

            {/* Delivery / Pickup Toggle */}
            <div data-testid="delivery-toggle" className="flex gap-2 mb-6 sm:mb-8">
              {["delivery", "pickup"].map((method) => (
                <button
                  key={method}
                  data-testid={`toggle-${method}`}
                  onClick={() => setDeliveryMethod(method)}
                  className={`px-4 sm:px-5 py-2.5 rounded-full font-body text-sm font-medium border transition-all duration-200 active:scale-95 ${
                    deliveryMethod === method
                      ? "bg-brand-surface border-brand-border text-brand-text shadow-sm"
                      : "bg-transparent border-transparent text-brand-text-secondary hover:text-brand-text"
                  }`}
                >
                  {method.charAt(0).toUpperCase() + method.slice(1)}
                </button>
              ))}
            </div>

            {/* Delivery Details */}
            {deliveryMethod === "delivery" && (
              <div data-testid="delivery-form">
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-brand-text mb-4 sm:mb-6">
                  Delivery Details
                </h2>
                <div className="space-y-4 sm:space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div>
                      <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">
                        Full Name
                      </Label>
                      <Input
                        data-testid="input-full-name"
                        placeholder="Jane Doe"
                        className="bg-brand-surface border-brand-border font-body text-sm h-12 sm:h-11"
                      />
                    </div>
                    <div>
                      <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">
                        Phone Number
                      </Label>
                      <Input
                        data-testid="input-phone"
                        placeholder="+1 (555) 000-0000"
                        type="tel"
                        className="bg-brand-surface border-brand-border font-body text-sm h-12 sm:h-11"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">
                      Street Address
                    </Label>
                    <Input
                      data-testid="input-street"
                      placeholder="123 Epicurean Way"
                      className="bg-brand-surface border-brand-border font-body text-sm h-12 sm:h-11"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:gap-5">
                    <div>
                      <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">
                        Apt / Suite
                      </Label>
                      <Input
                        data-testid="input-apt"
                        placeholder="Apt 4B"
                        className="bg-brand-surface border-brand-border font-body text-sm h-12 sm:h-11"
                      />
                    </div>
                    <div>
                      <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">
                        City
                      </Label>
                      <Input
                        data-testid="input-city"
                        placeholder="New York"
                        className="bg-brand-surface border-brand-border font-body text-sm h-12 sm:h-11"
                      />
                    </div>
                    <div>
                      <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">
                        Zip Code
                      </Label>
                      <Input
                        data-testid="input-zip"
                        placeholder="10001"
                        inputMode="numeric"
                        className="bg-brand-surface border-brand-border font-body text-sm h-12 sm:h-11"
                      />
                    </div>
                  </div>
                </div>

                {/* Promo Code — mobile inline */}
                <div data-testid="mobile-promo" className="flex gap-2 mt-6 lg:hidden">
                  <Input
                    placeholder="Promo Code"
                    className="bg-brand-surface border-brand-border font-body text-sm h-12 flex-1"
                  />
                  <button className="px-4 py-2 bg-brand-text text-white font-body text-sm font-medium rounded-lg active:scale-95 transition-all">
                    Apply
                  </button>
                </div>
              </div>
            )}

            {deliveryMethod === "pickup" && (
              <div data-testid="pickup-form">
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-brand-text mb-4">
                  Pickup Details
                </h2>
                <p className="font-body text-sm text-brand-text-secondary">
                  Your order will be available for pickup at our nearest location.
                  Estimated time: 25-35 minutes.
                </p>
              </div>
            )}

            {/* Payment Method */}
            <div data-testid="payment-section" className="mt-8 sm:mt-10">
              <h2 className="font-heading text-xl sm:text-2xl font-bold text-brand-text mb-4 sm:mb-6">
                Payment Method
              </h2>
              <RadioGroup defaultValue="card-saved" className="space-y-3">
                <label
                  data-testid="payment-saved-card"
                  className="flex items-center justify-between p-4 bg-brand-surface border border-brand-border rounded-xl cursor-pointer active:bg-brand-bg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="card-saved" id="card-saved" />
                    <CreditCard size={18} className="text-brand-text-secondary" />
                    <span className="font-body text-sm text-brand-text">
                      **** 4242
                    </span>
                  </div>
                  <span className="font-body text-xs text-brand-text-secondary">
                    Exp. 12/25
                  </span>
                </label>
                <label
                  data-testid="payment-new-card"
                  className="flex items-center gap-3 p-4 bg-brand-surface border border-brand-border rounded-xl cursor-pointer active:bg-brand-bg transition-colors"
                >
                  <RadioGroupItem value="card-new" id="card-new" />
                  <CirclePlus size={18} className="text-brand-text-secondary" />
                  <span className="font-body text-sm text-brand-text">
                    Add New Payment Method
                  </span>
                </label>
              </RadioGroup>
            </div>

            {/* Mobile: Complete Order CTA at bottom of form */}
            <div className="lg:hidden mt-8 pb-4">
              <div className="flex justify-between items-center mb-3">
                <span className="font-body text-sm text-brand-text-secondary">Total</span>
                <span className="font-heading text-2xl font-bold text-brand-text">${total.toFixed(2)}</span>
              </div>
              <button
                data-testid="mobile-complete-order-btn"
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-brand-primary text-white font-body text-sm font-semibold rounded-full active:scale-[0.97] transition-all cta-pulse"
              >
                Complete Order <ArrowRight size={16} />
              </button>
              <p className="font-body text-[10px] text-brand-text-secondary text-center mt-3">
                By completing your order, you agree to our{" "}
                <span className="underline cursor-pointer">Terms of Service</span>.
              </p>
            </div>
          </div>

          {/* Right: Order Summary — compact on mobile, card on desktop */}
          <div className="lg:col-span-2">
            <div
              data-testid="order-summary"
              className="bg-brand-surface border border-brand-border rounded-2xl p-4 sm:p-6 lg:sticky lg:top-20"
            >
              <h2 className="font-heading text-lg sm:text-xl font-bold text-brand-text mb-4 sm:mb-6">
                Your Curated Order
              </h2>

              <div className="space-y-4 sm:space-y-5">
                {displayItems.map((item) => (
                  <div
                    key={item.id}
                    data-testid={`order-item-${item.id}`}
                    className="flex gap-3 sm:gap-4"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading text-sm font-bold text-brand-text">
                        {item.name}
                      </h3>
                      <p className="font-body text-xs text-brand-text-secondary mt-0.5 line-clamp-1">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="inline-flex items-center border border-brand-border rounded-full text-xs">
                          <button
                            data-testid={`order-qty-minus-${item.id}`}
                            onClick={() => items.length > 0 && updateQty(item.id, item.qty - 1)}
                            className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center active:bg-brand-bg rounded-l-full transition-colors"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="w-5 text-center font-body text-xs">
                            {item.qty}
                          </span>
                          <button
                            data-testid={`order-qty-plus-${item.id}`}
                            onClick={() => items.length > 0 && updateQty(item.id, item.qty + 1)}
                            className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center active:bg-brand-bg rounded-r-full transition-colors"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <span className="font-heading text-sm font-bold text-brand-text flex-shrink-0">
                      ${(item.price * item.qty).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Desktop Promo Code */}
              <div data-testid="promo-code" className="hidden lg:flex gap-2 mt-6">
                <Input
                  data-testid="promo-input"
                  placeholder="Promo Code"
                  className="bg-brand-bg border-brand-border font-body text-sm h-10 flex-1"
                />
                <button
                  data-testid="promo-apply-btn"
                  className="px-4 py-2 bg-brand-text text-white font-body text-sm font-medium rounded-lg hover:bg-brand-text/90 transition-colors"
                >
                  Apply
                </button>
              </div>

              {/* Totals — compact on mobile */}
              <div className="mt-4 sm:mt-6 space-y-1.5 sm:space-y-2 border-t border-brand-border pt-3 sm:pt-4">
                <div className="flex justify-between font-body text-sm text-brand-text-secondary">
                  <span>Subtotal</span>
                  <span>${calcSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-body text-sm text-brand-text-secondary">
                  <span>Taxes</span>
                  <span>${taxes.toFixed(2)}</span>
                </div>
                {deliveryMethod === "delivery" && (
                  <div className="flex justify-between font-body text-sm text-brand-text-secondary">
                    <span>Delivery Fee</span>
                    <span>${deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-heading text-lg sm:text-xl font-bold text-brand-text pt-2">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Desktop CTA */}
              <button
                data-testid="complete-order-btn"
                className="hidden lg:flex w-full mt-6 items-center justify-center gap-2 px-6 py-4 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover transition-colors duration-200"
              >
                Complete Order <ArrowRight size={16} />
              </button>
              <p className="hidden lg:block font-body text-[10px] text-brand-text-secondary text-center mt-3">
                By completing your order, you agree to our{" "}
                <span className="underline cursor-pointer">Terms of Service</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
