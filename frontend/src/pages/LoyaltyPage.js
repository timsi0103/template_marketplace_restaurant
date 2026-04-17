import { Star, Gift, Award, TrendingUp } from "lucide-react";
import { Separator } from "../components/ui/separator";

export default function LoyaltyPage() {
  return (
    <div data-testid="loyalty-page" className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <h1
          data-testid="loyalty-title"
          className="font-heading text-4xl sm:text-5xl font-bold text-brand-text tracking-tight mb-2"
        >
          Loyalty & Subscriptions
        </h1>
        <p className="font-body text-sm text-brand-text-secondary mb-10">
          Elevate your culinary journey with exclusive rewards and curated subscriptions.
        </p>

        {/* Loyalty Points Card */}
        <div
          data-testid="loyalty-points-card"
          className="bg-brand-surface border border-brand-border rounded-2xl p-8 mb-8"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">
                Your Points Balance
              </span>
              <p className="font-heading text-4xl font-bold text-brand-primary mt-1">
                2,450
              </p>
              <p className="font-body text-xs text-brand-text-secondary mt-1">
                550 points until Gold tier
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-brand-orange/10 flex items-center justify-center">
              <Star size={20} className="text-brand-orange" />
            </div>
          </div>
          {/* Progress bar skeleton */}
          <div className="mt-6">
            <div className="flex justify-between font-body text-xs text-brand-text-secondary mb-2">
              <span>Silver</span>
              <span>Gold</span>
            </div>
            <div className="h-2 bg-brand-bg rounded-full overflow-hidden">
              <div
                data-testid="loyalty-progress-bar"
                className="h-full bg-brand-primary rounded-full"
                style={{ width: "82%" }}
              />
            </div>
          </div>
        </div>

        {/* Perks Grid */}
        <div
          data-testid="perks-grid"
          className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10"
        >
          {[
            {
              icon: Gift,
              title: "Rewards",
              desc: "Redeem points for exclusive menu items and experiences.",
            },
            {
              icon: Award,
              title: "Tier Benefits",
              desc: "Unlock priority reservations, free delivery, and more.",
            },
            {
              icon: TrendingUp,
              title: "Earn More",
              desc: "Double points on weekends and featured collections.",
            },
          ].map((perk) => {
            const Icon = perk.icon;
            return (
              <div
                key={perk.title}
                data-testid={`perk-card-${perk.title.toLowerCase()}`}
                className="bg-brand-surface border border-brand-border rounded-xl p-5"
              >
                <div className="w-10 h-10 rounded-lg bg-brand-bg flex items-center justify-center mb-3">
                  <Icon size={18} className="text-brand-primary" />
                </div>
                <h3 className="font-heading text-base font-bold text-brand-text">
                  {perk.title}
                </h3>
                <p className="font-body text-xs text-brand-text-secondary mt-1 leading-relaxed">
                  {perk.desc}
                </p>
              </div>
            );
          })}
        </div>

        <Separator className="bg-brand-border my-8" />

        {/* Subscriptions Skeleton */}
        <h2
          data-testid="subscriptions-title"
          className="font-heading text-2xl sm:text-3xl font-bold text-brand-text mb-6"
        >
          Curated Subscriptions
        </h2>
        <div
          data-testid="subscriptions-grid"
          className="grid grid-cols-1 sm:grid-cols-2 gap-5"
        >
          {[
            {
              name: "The Weekly Curation",
              price: "$49/week",
              desc: "A rotating selection of our finest dishes, delivered to your door every week.",
            },
            {
              name: "The Artisan Box",
              price: "$89/month",
              desc: "Premium pantry staples from our D2C partners. Oils, spices, preserves, and more.",
            },
          ].map((sub) => (
            <div
              key={sub.name}
              data-testid={`subscription-card-${sub.name.toLowerCase().replace(/\s+/g, "-")}`}
              className="bg-brand-surface border border-brand-border rounded-2xl p-6"
            >
              <h3 className="font-heading text-xl font-bold text-brand-text">
                {sub.name}
              </h3>
              <p className="font-heading text-lg font-bold text-brand-primary mt-1">
                {sub.price}
              </p>
              <p className="font-body text-sm text-brand-text-secondary mt-2 leading-relaxed">
                {sub.desc}
              </p>
              <button
                data-testid={`subscribe-btn-${sub.name.toLowerCase().replace(/\s+/g, "-")}`}
                className="mt-4 w-full py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover transition-colors"
              >
                Subscribe Now
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
