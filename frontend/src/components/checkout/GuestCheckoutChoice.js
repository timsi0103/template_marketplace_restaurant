import { Link } from "react-router-dom";
import { User, UserCheck, Gift, Clock, Repeat, X } from "lucide-react";

/**
 * Top-of-checkout choice: sign-in/register OR continue as guest.
 * Dismissible (collapses to a thin pill) so returning guests aren't pestered.
 */
export default function GuestCheckoutChoice({ email, onContinueAsGuest, dismissed, onDismiss }) {
  if (dismissed) {
    return (
      <div data-testid="guest-choice-collapsed" className="mb-4 flex items-center justify-between px-4 py-2.5 rounded-full bg-brand-surface border border-brand-border text-xs font-body">
        <span className="text-brand-text-secondary">Checking out as guest{email ? ` · ${email}` : ""}.</span>
        <Link to="/login?redirect=/checkout" data-testid="guest-switch-to-login" className="font-semibold text-brand-primary hover:underline">Sign in</Link>
      </div>
    );
  }

  return (
    <div data-testid="guest-checkout-choice" className="mb-5 sm:mb-6 bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6 relative">
      <button
        data-testid="guest-choice-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 text-brand-text-secondary hover:text-brand-primary"
      >
        <X size={14} />
      </button>
      <h2 className="font-heading text-lg sm:text-xl font-bold text-brand-text">Signing in?</h2>
      <p className="font-body text-xs sm:text-sm text-brand-text-secondary mt-1">
        Have an account with us? Sign in for a faster checkout — or continue as a guest.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <Link
          to="/login?redirect=/checkout"
          data-testid="checkout-signin-btn"
          className="group flex items-start gap-3 p-4 rounded-xl border border-brand-primary/30 bg-brand-primary/5 hover:bg-brand-primary/10 transition"
        >
          <div className="w-9 h-9 rounded-full bg-brand-primary text-white flex items-center justify-center flex-shrink-0">
            <UserCheck size={16} />
          </div>
          <div className="flex-1">
            <div className="font-heading text-sm font-bold text-brand-text">Sign in / Create account</div>
            <ul className="mt-1.5 space-y-1 text-[11px] font-body text-brand-text-secondary">
              <li className="flex items-center gap-1.5"><Clock size={10} className="text-brand-primary" /> Track all your orders</li>
              <li className="flex items-center gap-1.5"><Repeat size={10} className="text-brand-primary" /> One-tap reorder</li>
              <li className="flex items-center gap-1.5"><Gift size={10} className="text-brand-primary" /> Earn loyalty points on every order</li>
            </ul>
          </div>
        </Link>

        <button
          data-testid="checkout-continue-guest-btn"
          onClick={onContinueAsGuest}
          className="group flex items-start gap-3 p-4 rounded-xl border border-brand-border bg-brand-bg hover:border-brand-primary/40 transition text-left"
        >
          <div className="w-9 h-9 rounded-full bg-brand-text/90 text-white flex items-center justify-center flex-shrink-0">
            <User size={16} />
          </div>
          <div className="flex-1">
            <div className="font-heading text-sm font-bold text-brand-text">Continue as guest</div>
            <p className="mt-1.5 text-[11px] font-body text-brand-text-secondary leading-relaxed">
              Just your email — we'll send a receipt and tracking link. You can create an account after you pay.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
