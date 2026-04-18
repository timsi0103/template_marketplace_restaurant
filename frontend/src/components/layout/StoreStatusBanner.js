import { useStoreStatus } from "@/contexts/StoreStatusContext";
import { X, AlertTriangle } from "lucide-react";
import { useState } from "react";

export default function StoreStatusBanner() {
  const { status, loading } = useStoreStatus();
  const [dismissed, setDismissed] = useState(false);

  if (loading || !status || dismissed) return null;

  const holiday = status.active_holiday;
  const pauseOrdering = status.pause_ordering;

  // Holiday banner
  if (holiday) {
    return (
      <div data-testid="holiday-banner" className="bg-brand-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <p className="font-body text-xs sm:text-sm font-medium truncate">
              {holiday.reason || "We're closed today"} &mdash; {holiday.date}
            </p>
          </div>
          <button data-testid="dismiss-holiday-banner" onClick={() => setDismissed(true)} className="w-6 h-6 rounded-full hover:bg-white/20 flex items-center justify-center flex-shrink-0 transition-colors">
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  // Pause ordering banner
  if (pauseOrdering) {
    return (
      <div data-testid="pause-banner" className="bg-red-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <p className="font-body text-xs sm:text-sm font-medium">Ordering is temporarily paused. You can still browse our menu.</p>
          </div>
          <button data-testid="dismiss-pause-banner" onClick={() => setDismissed(true)} className="w-6 h-6 rounded-full hover:bg-white/20 flex items-center justify-center flex-shrink-0 transition-colors">
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
