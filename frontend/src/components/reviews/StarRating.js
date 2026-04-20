import { Star } from "lucide-react";
import { useState } from "react";

/** Read-only or interactive star rating (1–5). */
export default function StarRating({
  value = 0,
  onChange,
  size = 16,
  readOnly = false,
  showValue = false,
  count,
  testIdPrefix = "star",
}) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <span data-testid={`${testIdPrefix}-rating`} className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= Math.round(display);
          const halfFilled = !filled && n - 0.5 <= display;
          return (
            <button
              key={n}
              type="button"
              data-testid={`${testIdPrefix}-${n}`}
              disabled={readOnly}
              onMouseEnter={() => !readOnly && setHover(n)}
              onMouseLeave={() => !readOnly && setHover(0)}
              onClick={() => !readOnly && onChange?.(n)}
              className={`${readOnly ? "cursor-default" : "cursor-pointer hover:scale-110 active:scale-95"} transition-transform`}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
            >
              <Star
                size={size}
                className={
                  filled
                    ? "fill-amber-400 text-amber-400"
                    : halfFilled
                    ? "fill-amber-200 text-amber-400"
                    : "fill-transparent text-brand-border"
                }
                strokeWidth={1.5}
              />
            </button>
          );
        })}
      </span>
      {showValue && value > 0 && (
        <span className="font-body text-xs text-brand-text-secondary tabular-nums">
          {Number(value).toFixed(1)}
          {typeof count === "number" && <span className="ml-1">({count.toLocaleString()})</span>}
        </span>
      )}
    </span>
  );
}
