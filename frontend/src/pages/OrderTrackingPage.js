import { Package, MapPin, Clock, CheckCircle } from "lucide-react";

const steps = [
  { label: "Order Placed", time: "2:15 PM", done: true },
  { label: "Preparing", time: "2:18 PM", done: true },
  { label: "Ready for Pickup", time: "Est. 2:45 PM", done: false },
  { label: "Delivered", time: "Est. 3:00 PM", done: false },
];

export default function OrderTrackingPage() {
  return (
    <div data-testid="order-tracking-page" className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <h1
          data-testid="tracking-title"
          className="font-heading text-4xl sm:text-5xl font-bold text-brand-text tracking-tight mb-2"
        >
          Order Tracking
        </h1>
        <p className="font-body text-sm text-brand-text-secondary mb-10">
          Follow your curated order in real-time.
        </p>

        {/* Order Info Card */}
        <div
          data-testid="tracking-order-card"
          className="bg-brand-surface border border-brand-border rounded-2xl p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">
                Order
              </span>
              <p className="font-heading text-2xl font-bold text-brand-text">
                #1042
              </p>
            </div>
            <span className="px-3 py-1 bg-brand-orange/10 text-brand-orange font-body text-xs font-semibold uppercase tracking-wider rounded-full">
              In Progress
            </span>
          </div>

          <div className="flex items-center gap-6 text-brand-text-secondary font-body text-sm">
            <div className="flex items-center gap-1.5">
              <Package size={14} />
              <span>3 items</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin size={14} />
              <span>Delivery</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={14} />
              <span>Est. 45 min</span>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div data-testid="tracking-steps" className="bg-brand-surface border border-brand-border rounded-2xl p-6">
          <h2 className="font-heading text-xl font-bold text-brand-text mb-6">
            Delivery Progress
          </h2>
          <div className="space-y-0">
            {steps.map((step, idx) => (
              <div key={step.label} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    data-testid={`step-indicator-${idx}`}
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      step.done
                        ? "bg-brand-primary"
                        : "bg-brand-bg border-2 border-brand-border"
                    }`}
                  >
                    {step.done ? (
                      <CheckCircle size={16} className="text-white" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-brand-border" />
                    )}
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      className={`w-0.5 h-10 ${
                        step.done ? "bg-brand-primary" : "bg-brand-border"
                      }`}
                    />
                  )}
                </div>
                <div className="pb-8">
                  <p
                    className={`font-body text-sm font-medium ${
                      step.done ? "text-brand-text" : "text-brand-text-secondary"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="font-body text-xs text-brand-text-secondary mt-0.5">
                    {step.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Placeholder Map */}
        <div
          data-testid="tracking-map-placeholder"
          className="mt-8 bg-brand-bg border border-brand-border rounded-2xl h-48 flex items-center justify-center"
        >
          <div className="text-center">
            <MapPin size={24} className="mx-auto text-brand-text-secondary mb-2" />
            <p className="font-body text-sm text-brand-text-secondary">
              Live map tracking will appear here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
