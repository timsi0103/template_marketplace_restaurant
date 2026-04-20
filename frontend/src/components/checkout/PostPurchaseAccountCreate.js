import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Mail, Lock, Gift, CheckCircle2, Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

const API = "/api";

/**
 * Post-purchase account-creation card rendered on OrderSuccessPage for guest orders.
 * - Email pre-filled from the completed order (read-only).
 * - Single password field (no confirm — following modern UX).
 * - On submit, POSTs to /api/auth/claim-orders which creates the account AND links
 *   every guest order on that email to the new user_id; cookies are set server-side.
 */
export default function PostPurchaseAccountCreate({ order, onCreated }) {
  const { refreshAuth } = useAuth();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState({ success: false, claimed: 0, points: 0 });

  if (!order?.id || !order?.contact_email) return null;

  if (state.success) {
    return (
      <div data-testid="account-created-state" className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-full bg-green-600 text-white flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading text-lg font-bold text-green-900">Account created</h3>
            <p className="font-body text-sm text-green-900/80 mt-1 leading-relaxed">
              Signed in as <span className="font-semibold">{order.contact_email}</span>. This order
              {state.claimed > 1 ? ` and ${state.claimed - 1} earlier guest order${state.claimed - 1 === 1 ? "" : "s"}` : ""} {state.claimed > 1 ? "are" : "is"} now linked to your account.
            </p>
            {state.points > 0 && (
              <div data-testid="account-created-points" className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-green-300 text-green-800 text-xs font-body font-semibold">
                <Gift size={13} /> You earned {state.points} loyalty point{state.points === 1 ? "" : "s"}
              </div>
            )}
            <a
              href="/orders"
              data-testid="account-created-orders-link"
              className="mt-4 inline-flex items-center gap-1 font-body text-sm font-semibold text-green-900 hover:underline"
            >
              View your orders <ArrowRight size={13} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API}/auth/claim-orders`, {
        email: order.contact_email,
        password,
        order_id: order.id,
      }, { withCredentials: true });
      setState({ success: true, claimed: data.claimed_orders || 1, points: data.loyalty_points || 0 });
      await refreshAuth();
      toast.success("Account created — you're signed in");
      onCreated?.(data);
    } catch (e) {
      const detail = e?.response?.data?.detail || "Could not create account";
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form data-testid="post-purchase-signup-card" onSubmit={submit} className="mt-6 rounded-2xl bg-brand-surface border border-brand-border p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0">
          <Gift size={18} />
        </div>
        <div>
          <h3 className="font-heading text-lg font-bold text-brand-text">Save this order to your account</h3>
          <p className="font-body text-xs text-brand-text-secondary mt-0.5 leading-relaxed max-w-lg">
            Create a quick account to track this order, reorder faster next time, and start earning loyalty points.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5 flex items-center gap-1.5">
            <Mail size={11} /> Email
          </Label>
          <Input
            data-testid="pp-signup-email"
            value={order.contact_email}
            disabled
            readOnly
            className="bg-brand-bg border-brand-border h-11 text-brand-text-secondary"
          />
        </div>
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5 flex items-center gap-1.5">
            <Lock size={11} /> Choose a password
          </Label>
          <div className="relative">
            <Input
              data-testid="pp-signup-password"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              minLength={6}
              required
              className="bg-brand-bg border-brand-border h-11 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-secondary hover:text-brand-primary"
            >
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </div>

      <button
        type="submit"
        data-testid="pp-signup-submit"
        disabled={submitting || password.length < 6}
        className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50 transition active:scale-[0.98]"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
        Create account
      </button>
      <p className="mt-3 text-[11px] text-brand-text-secondary">
        By creating an account you agree to our terms.
      </p>
    </form>
  );
}
