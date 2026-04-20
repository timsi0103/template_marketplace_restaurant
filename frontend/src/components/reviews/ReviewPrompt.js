import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Sparkles, CheckCircle2, Clock } from "lucide-react";
import StarRating from "./StarRating";

const API = "/api";

/**
 * Shown on the customer order-tracking page and in the orders list.
 * Becomes visible only when the order is fulfilled AND the admin-configured delay
 * has elapsed since delivery/completion. If the customer has already submitted a
 * review, displays a "Thanks!" state instead.
 */
export default function ReviewPrompt({ orderId, compact = false }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/reviews/request/${orderId}`);
        if (!stopped) setState(data);
      } catch {
        if (!stopped) setState(null);
      } finally {
        if (!stopped) setLoading(false);
      }
    })();
    return () => { stopped = true; };
  }, [orderId]);

  if (loading || !state) return null;

  if (state.submitted) {
    return (
      <div data-testid="review-submitted-banner" className={`flex items-start gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50 ${compact ? "text-xs" : "text-sm"}`}>
        <CheckCircle2 size={compact ? 14 : 18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="font-heading font-bold text-emerald-800">Thanks for your review!</div>
          <div className={`${compact ? "text-[11px]" : "text-xs"} text-emerald-700 mt-0.5`}>Your feedback helps our kitchen improve.</div>
        </div>
      </div>
    );
  }

  if (!state.eligible) {
    if (state.seconds_until_prompt > 0 && !compact) {
      return (
        <div data-testid="review-pending-banner" className="flex items-center gap-2 p-3 rounded-xl border border-brand-border bg-brand-bg/50 text-xs text-brand-text-secondary">
          <Clock size={14} />
          We'll invite you to review this order shortly.
        </div>
      );
    }
    return null;
  }

  return (
    <div
      data-testid="review-prompt-banner"
      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-white ${compact ? "" : "mb-4"}`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
          <Sparkles size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-heading text-sm sm:text-base font-bold text-brand-text">How was your order?</div>
          <div className="font-body text-xs text-brand-text-secondary mt-0.5 line-clamp-2">
            {state.message_template}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:flex-shrink-0">
        <StarRating value={0} readOnly size={18} testIdPrefix={`prompt-${orderId}`} />
        <Link
          to={`/review/${orderId}`}
          data-testid="review-prompt-cta"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-primary text-white text-xs font-body font-semibold hover:bg-brand-primary-hover active:scale-95 transition-all whitespace-nowrap"
        >
          Rate your order
        </Link>
      </div>
    </div>
  );
}
