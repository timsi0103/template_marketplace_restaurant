import { Check } from "lucide-react";

export default function CheckoutStepper({ steps, currentKey }) {
  const currentIdx = steps.findIndex((s) => s.key === currentKey);
  return (
    <ol data-testid="checkout-stepper" className="flex items-center gap-1 sm:gap-3 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={s.key} className="flex items-center flex-shrink-0">
            <div
              data-testid={`stepper-${s.key}`}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-body font-medium transition ${
                active
                  ? "bg-brand-primary text-white"
                  : done
                    ? "bg-brand-primary/10 text-brand-primary"
                    : "bg-brand-surface border border-brand-border text-brand-text-secondary"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-heading font-bold ${
                  active ? "bg-white text-brand-primary" : done ? "bg-brand-primary text-white" : "bg-brand-border text-brand-text"
                }`}
              >
                {done ? <Check size={11} /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && <span className="w-4 sm:w-6 h-px bg-brand-border mx-1" />}
          </li>
        );
      })}
    </ol>
  );
}
