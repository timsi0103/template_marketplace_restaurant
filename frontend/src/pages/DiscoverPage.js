import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { ArrowRight, Sparkles, Tag, TrendingUp, Award } from "lucide-react";

const API = "/api";

/**
 * Editorial Discover page — curated landing for browsing collections,
 * featured stories, top-rated items, and seasonal picks. Distinct from
 * the home `/` route (which is the brand hero) and the `/menu` route
 * (which is the full grid).
 */
export default function DiscoverPage() {
  const [cats, setCats] = useState([]);
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    axios.get(`${API}/categories/tree`).then(({ data }) => setCats(data.categories || [])).catch(() => {});
    axios.get(`${API}/menu/items`).then(({ data }) => {
      const items = (data.items || []).filter((i) => (i.rating_count || 0) > 0);
      items.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0));
      setTrending(items.slice(0, 6));
    }).catch(() => {});
  }, []);

  return (
    <div data-testid="discover-page" className="min-h-screen">
      {/* Hero */}
      <section data-testid="discover-hero" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="text-[10px] uppercase tracking-[0.3em] text-brand-primary font-semibold mb-2">Discover</div>
        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-brand-text tracking-tight max-w-3xl leading-[1.05]">
          The editor's table — handpicked collections, top-rated dishes, seasonal stories.
        </h1>
        <p className="font-body text-base sm:text-lg text-brand-text-secondary mt-4 max-w-2xl">
          A curated way to browse the kitchen. Drop in for inspiration, leave with dinner.
        </p>
      </section>

      {/* Collections from categories */}
      <section data-testid="discover-collections" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-14">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-brand-primary font-semibold mb-1.5">Collections</div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-brand-text">Browse by craving</h2>
          </div>
          <Link to="/menu" data-testid="discover-full-menu-link" className="hidden sm:inline-flex items-center gap-1 font-body text-sm font-semibold text-brand-primary hover:underline">
            Full menu <ArrowRight size={14} />
          </Link>
        </div>
        {cats.length === 0 ? (
          <p className="text-sm italic text-brand-text-secondary py-8">Loading collections…</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {cats.map((c) => (
              <Link
                key={c.id}
                to={`/menu/${c.slug}`}
                data-testid={`discover-cat-${c.slug}`}
                className="group relative overflow-hidden rounded-2xl aspect-[4/5] bg-brand-surface"
              >
                {c.image ? (
                  <img src={c.image} alt={c.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/20 to-brand-orange/20" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 text-white">
                  <div className="font-heading text-xl sm:text-2xl font-bold">{c.name}</div>
                  <div className="text-[11px] sm:text-xs opacity-80 line-clamp-2 mt-0.5">{c.description}</div>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-orange opacity-0 group-hover:opacity-100 transition-opacity">
                    Explore <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Editorial picks band */}
      <section className="bg-brand-surface border-y border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8">
          {[
            { icon: Sparkles, title: "Chef's signatures", text: "The dishes our chefs would put on a desert island.", link: "/menu/mains", testid: "discover-chip-signatures" },
            { icon: TrendingUp, title: "Highest rated", text: "Real ratings, surfaced from verified orders.", link: "/menu", testid: "discover-chip-rated" },
            { icon: Tag, title: "Today's deals", text: "Seasonal pairings and limited-time coupons.", link: "/menu", testid: "discover-chip-deals" },
          ].map((c, i) => {
            const Icon = c.icon;
            return (
              <Link key={i} to={c.link} data-testid={c.testid} className="flex items-start gap-3 group">
                <span className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0">
                  <Icon size={18} />
                </span>
                <div>
                  <div className="font-heading text-base sm:text-lg font-bold text-brand-text group-hover:text-brand-primary transition-colors">{c.title}</div>
                  <p className="font-body text-sm text-brand-text-secondary mt-0.5">{c.text}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Top rated grid */}
      {trending.length > 0 && (
        <section data-testid="discover-trending" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-brand-primary font-semibold mb-1.5">Reader favorites</div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-brand-text">Top rated this season</h2>
            </div>
            <Link to="/menu" className="hidden sm:inline-flex items-center gap-1 font-body text-sm font-semibold text-brand-primary hover:underline">
              See more <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {trending.map((it) => (
              <Link
                key={it.id}
                to={`/product/${it.id}`}
                data-testid={`discover-top-${it.id}`}
                className="group bg-brand-surface rounded-xl overflow-hidden border border-brand-border"
              >
                <div className="aspect-square overflow-hidden bg-brand-bg">
                  <img src={it.image} alt={it.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-3">
                  <div className="font-heading text-sm font-bold text-brand-text truncate">{it.name}</div>
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-brand-text-secondary">
                    <Award size={11} className="text-amber-500" />
                    <span className="font-semibold text-brand-text">{Number(it.rating_avg || 0).toFixed(1)}</span>
                    <span>· ${Number(it.price).toFixed(2)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
