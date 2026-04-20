import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";

const DIETARY_LABELS = {
  vegan: "Vegan", vegetarian: "Vegetarian", gluten_free: "Gluten-Free",
  dairy_free: "Dairy-Free", halal: "Halal", kosher: "Kosher",
  nut_free: "Nut-Free", spicy: "Spicy", low_carb: "Low-Carb",
};

export default function FilterDrawer({
  open, onClose,
  dietaryOptions,              // array of tag keys the admin has enabled
  activeDietary,               // Set of active tag keys
  onToggleDietary,
  priceRange, onPriceChange,   // [min, max]
  priceBounds,                 // { min, max } absolute bounds
  inStockOnly, onStockToggle,
  showInStock = true,
  onReset, activeCount,
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose?.()}>
      <SheetContent side="right" className="w-[88%] sm:max-w-md" data-testid="filter-drawer">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl text-brand-text">Filters{activeCount ? ` (${activeCount})` : ""}</SheetTitle>
        </SheetHeader>
        <div className="mt-5 space-y-6">
          {dietaryOptions.length > 0 && (
            <section>
              <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Dietary</Label>
              <div className="flex flex-wrap gap-1.5 mt-2" data-testid="dietary-chips">
                {dietaryOptions.map((key) => {
                  const active = activeDietary.has(key);
                  return (
                    <button
                      key={key}
                      data-testid={`dietary-chip-${key}`}
                      onClick={() => onToggleDietary(key)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-body font-medium transition ${active ? "bg-brand-primary text-white border-brand-primary" : "border-brand-border text-brand-text hover:border-brand-primary/40"}`}
                    >
                      {DIETARY_LABELS[key] || key}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between">
              <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Price range</Label>
              <span data-testid="price-range-label" className="font-body text-sm font-semibold text-brand-text">
                ${priceRange[0]} — ${priceRange[1]}
              </span>
            </div>
            <div className="mt-3 px-1">
              <Slider
                data-testid="price-slider"
                min={priceBounds.min}
                max={priceBounds.max}
                step={1}
                value={priceRange}
                onValueChange={onPriceChange}
                className=""
              />
              <div className="flex justify-between text-[10px] text-brand-text-secondary mt-2">
                <span>${priceBounds.min}</span>
                <span>${priceBounds.max}</span>
              </div>
            </div>
          </section>

          {showInStock && (
            <section className="flex items-center justify-between">
              <div>
                <Label className="font-body text-sm font-medium text-brand-text">In stock only</Label>
                <p className="text-[11px] text-brand-text-secondary mt-0.5">Hide sold-out items</p>
              </div>
              <Switch
                data-testid="in-stock-switch"
                checked={inStockOnly}
                onCheckedChange={onStockToggle}
              />
            </section>
          )}

          {activeCount > 0 && (
            <button
              data-testid="filter-reset-btn"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 text-xs font-body font-semibold text-brand-primary hover:underline"
            >
              <RotateCcw size={12} /> Reset all filters
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
