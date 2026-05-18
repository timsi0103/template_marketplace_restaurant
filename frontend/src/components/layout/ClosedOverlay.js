import { useStoreStatus } from "@/contexts/StoreStatusContext";
import { Link, useLocation } from "react-router-dom";
import { Clock, UtensilsCrossed, CalendarClock } from "lucide-react";

export default function ClosedOverlay() {
  const { status, loading } = useStoreStatus();
  const location = useLocation();

  if (loading || !status) return null;
  if (status.is_open) return null;

  // Only block the homepage. On every other route the non-blocking
  // `StoreStatusBanner` at the top of the page communicates the closed state
  // without preventing the user from navigating to Discover, Orders, Account, etc.
  if (location.pathname !== "/") return null;

  return (
    <div data-testid="closed-overlay" className="fixed inset-0 z-[90] bg-brand-bg/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
          <Clock size={28} className="text-red-500" />
        </div>

        {/* Status */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full mb-4">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span data-testid="closed-status-text" className="font-body text-xs font-semibold text-red-600 uppercase tracking-wider">
            {status.pause_ordering ? "Ordering Paused" : "We're Closed"}
          </span>
        </div>

        <h2 data-testid="closed-heading" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text tracking-tight mb-3">
          {status.pause_ordering ? "Ordering is paused" : status.active_holiday?.reason || "We'll Be Back Soon"}
        </h2>

        {status.active_holiday?.message && (
          <p data-testid="holiday-message" className="font-body text-sm text-brand-text-secondary mb-4 max-w-sm mx-auto leading-relaxed">
            {status.active_holiday.message}
          </p>
        )}

        {status.pause_ordering && status.pause_reason && (
          <p data-testid="pause-reason" className="font-body text-sm text-brand-text-secondary mb-2">
            {status.pause_reason}
          </p>
        )}
        {status.pause_ordering && status.pause_until && (
          <p data-testid="pause-until" className="font-body text-xs text-brand-text-secondary mb-4">
            Estimated reopen:{" "}
            <span className="font-semibold text-brand-text">
              {new Date(status.pause_until).toLocaleString()}
            </span>
          </p>
        )}

        {status.next_open && !status.pause_ordering && (
          <p data-testid="next-open-time" className="font-body text-sm text-brand-text-secondary mb-6">
            Next service opens <span className="font-semibold text-brand-text">{status.next_open}</span>
          </p>
        )}

        {/* Service hours */}
        {status.services && (
          <div data-testid="service-hours" className="bg-brand-surface border border-brand-border rounded-xl p-4 mb-6 text-left">
            <p className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-3">Today's Hours</p>
            <div className="space-y-2">
              {[
                { key: "delivery", label: "Delivery", icon: "truck" },
                { key: "pickup", label: "Pickup", icon: "package" },
                { key: "dine_in", label: "Dine-In", icon: "utensils" },
              ].map(({ key, label }) => {
                const svc = status.services[key];
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="font-body text-sm text-brand-text">{label}</span>
                    <span className={`font-body text-sm font-medium ${svc?.available ? "text-green-600" : "text-red-500"}`}>
                      {svc?.hours || "Closed"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/menu" data-testid="browse-menu-btn"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-surface border border-brand-border text-brand-text font-body text-sm font-medium rounded-full hover:bg-brand-bg transition-colors">
            <UtensilsCrossed size={16} /> Browse Menu
          </Link>
          {status.accept_advance_orders !== false && (
            <button data-testid="order-later-btn"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover transition-colors">
              <CalendarClock size={16} /> Order for Later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
