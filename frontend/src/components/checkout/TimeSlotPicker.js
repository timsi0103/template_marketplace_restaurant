import { Clock, Zap } from "lucide-react";

// Fixed hardcoded demo slots — typical lunch/dinner windows
const SLOTS = [
  { label: "12:00 – 12:30 PM", soldOut: false },
  { label: "12:30 – 1:00 PM", soldOut: true },
  { label: "1:00 – 1:30 PM", soldOut: false },
  { label: "1:30 – 2:00 PM", soldOut: false },
  { label: "6:00 – 6:30 PM", soldOut: false },
  { label: "6:30 – 7:00 PM", soldOut: true },
  { label: "7:00 – 7:30 PM", soldOut: false },
  { label: "7:30 – 8:00 PM", soldOut: false },
  { label: "8:00 – 8:30 PM", soldOut: false },
];

export default function TimeSlotPicker({ value, onChange }) {
  return (
    <div data-testid="time-slot-picker">
      <button
        data-testid="slot-asap"
        onClick={() => onChange("ASAP")}
        className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition active:scale-[0.99] mb-4 ${
          value === "ASAP" ? "border-brand-primary bg-brand-primary/5" : "border-brand-border bg-brand-bg hover:border-brand-primary/40"
        }`}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${value === "ASAP" ? "bg-brand-primary text-white" : "bg-brand-surface text-brand-text"}`}>
          <Zap size={16} />
        </div>
        <div className="text-left">
          <div className="font-heading text-base font-bold text-brand-text">As soon as possible</div>
          <div className="font-body text-xs text-brand-text-secondary">Typically ready in 20–30 min</div>
        </div>
      </button>

      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} className="text-brand-text-secondary" />
        <span className="font-body text-[11px] uppercase tracking-widest text-brand-text-secondary">Or schedule a time</span>
      </div>

      <div data-testid="slot-list" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SLOTS.map((s) => {
          const active = value === s.label;
          const disabled = s.soldOut;
          return (
            <button
              key={s.label}
              data-testid={`slot-${s.label.replace(/\s/g, "").replace(/[^\w]/g, "")}`}
              onClick={() => !disabled && onChange(s.label)}
              disabled={disabled}
              className={`px-3 py-2.5 rounded-lg text-xs font-body font-medium border transition text-center ${
                active
                  ? "bg-brand-primary text-white border-brand-primary"
                  : disabled
                    ? "bg-brand-bg border-brand-border text-brand-text-secondary opacity-40 cursor-not-allowed line-through"
                    : "bg-brand-bg border-brand-border text-brand-text hover:border-brand-primary/40"
              }`}
            >
              {s.label}
              {disabled && <span className="block text-[9px] uppercase tracking-widest mt-0.5">Sold out</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
