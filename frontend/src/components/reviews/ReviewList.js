import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ThumbsUp, BadgeCheck, Loader2, MessageSquare } from "lucide-react";
import StarRating from "./StarRating";

const API = "/api";

const SORT_OPTIONS = [
  { value: "recent", label: "Most recent" },
  { value: "helpful", label: "Most helpful" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

export default function ReviewList({ itemId }) {
  const [summary, setSummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("recent");
  const [ratingFilter, setRatingFilter] = useState(0); // 0 = all
  const [helpfulIds, setHelpfulIds] = useState(new Set());

  async function load() {
    setLoading(true);
    try {
      const params = { sort, limit: 50 };
      if (ratingFilter) params.rating = ratingFilter;
      const [s, r] = await Promise.all([
        axios.get(`${API}/menu/items/${itemId}/reviews/summary`),
        axios.get(`${API}/menu/items/${itemId}/reviews`, { params }),
      ]);
      setSummary(s.data);
      setReviews(r.data.reviews || []);
    } catch {
      setSummary(null);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [itemId, sort, ratingFilter]);

  const total = summary?.rating_count || 0;
  const distribution = summary?.distribution || {};

  const distRows = useMemo(() => {
    return [5, 4, 3, 2, 1].map((n) => ({
      n,
      count: distribution[String(n)] || 0,
      pct: total > 0 ? ((distribution[String(n)] || 0) / total) * 100 : 0,
    }));
  }, [distribution, total]);

  async function markHelpful(id) {
    if (helpfulIds.has(id)) return;
    setHelpfulIds((p) => new Set(p).add(id));
    try {
      const { data } = await axios.post(`${API}/reviews/${id}/helpful`);
      setReviews((prev) => prev.map((r) => (r.id === id ? data.review : r)));
    } catch {
      setHelpfulIds((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
    }
  }

  if (loading && !summary) {
    return (
      <div data-testid="reviews-loading" className="flex items-center gap-2 text-sm text-brand-text-secondary py-8">
        <Loader2 size={14} className="animate-spin" /> Loading reviews…
      </div>
    );
  }

  return (
    <section data-testid="item-reviews-section" className="mt-10 pt-8 border-t border-brand-border">
      <h2 className="font-heading text-xl sm:text-2xl font-bold text-brand-text mb-4">Customer reviews</h2>

      {total === 0 ? (
        <div data-testid="reviews-empty" className="p-6 bg-brand-bg/50 border border-brand-border rounded-xl text-sm text-brand-text-secondary">
          No reviews yet — be the first to rate this dish after your next order.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 mb-6">
          <div className="p-5 bg-brand-surface border border-brand-border rounded-2xl">
            <div className="flex items-baseline gap-2">
              <span data-testid="reviews-avg" className="font-heading text-4xl font-bold text-brand-text">
                {Number(summary?.rating_avg || 0).toFixed(1)}
              </span>
              <span className="text-xs text-brand-text-secondary">/ 5</span>
            </div>
            <StarRating value={summary?.rating_avg || 0} size={16} readOnly />
            <div data-testid="reviews-count" className="text-xs text-brand-text-secondary mt-1.5">
              {total.toLocaleString()} verified {total === 1 ? "review" : "reviews"}
            </div>
            <div className="mt-4 space-y-1.5">
              {distRows.map((row) => (
                <button
                  key={row.n}
                  data-testid={`reviews-dist-${row.n}`}
                  onClick={() => setRatingFilter(ratingFilter === row.n ? 0 : row.n)}
                  className={`w-full flex items-center gap-2 text-xs group ${ratingFilter === row.n ? "font-semibold" : ""}`}
                >
                  <span className="w-3 text-brand-text-secondary">{row.n}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-brand-bg overflow-hidden">
                    <div
                      className={`h-full transition-all ${ratingFilter === row.n ? "bg-amber-500" : "bg-amber-400 group-hover:bg-amber-500"}`}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-brand-text-secondary tabular-nums">{row.count}</span>
                </button>
              ))}
              {ratingFilter > 0 && (
                <button
                  data-testid="reviews-dist-clear"
                  onClick={() => setRatingFilter(0)}
                  className="text-[11px] font-semibold text-brand-primary hover:underline mt-1"
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-xs text-brand-text-secondary">
                {ratingFilter > 0 ? `Showing ${ratingFilter}-star reviews` : `Showing ${reviews.length} of ${total}`}
              </div>
              <select
                data-testid="reviews-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-9 px-3 rounded-full border border-brand-border bg-brand-surface text-xs font-body font-medium text-brand-text outline-none focus:border-brand-primary/60"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-brand-text-secondary py-6">
                <Loader2 size={14} className="animate-spin" /> Updating…
              </div>
            ) : reviews.length === 0 ? (
              <div data-testid="reviews-filter-empty" className="p-6 bg-brand-bg/50 border border-brand-border rounded-xl text-sm text-brand-text-secondary">
                No reviews match that filter yet.
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <article
                    key={r.id}
                    data-testid={`review-card-${r.id}`}
                    className="p-4 bg-brand-surface border border-brand-border rounded-xl"
                  >
                    <header className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <StarRating value={r.rating} size={14} readOnly testIdPrefix={`review-stars-${r.id}`} />
                          <span className="font-body text-sm font-semibold text-brand-text">
                            {r.user_name || "Customer"}
                          </span>
                          {r.verified_purchase && (
                            <span data-testid={`review-verified-${r.id}`} className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                              <BadgeCheck size={10} /> Verified
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-brand-text-secondary mt-0.5">
                          {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      </div>
                      <button
                        data-testid={`review-helpful-${r.id}`}
                        onClick={() => markHelpful(r.id)}
                        disabled={helpfulIds.has(r.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-body font-medium transition-colors ${
                          helpfulIds.has(r.id)
                            ? "border-brand-primary/40 bg-brand-primary/10 text-brand-primary"
                            : "border-brand-border text-brand-text-secondary hover:border-brand-primary/40 hover:text-brand-primary"
                        }`}
                      >
                        <ThumbsUp size={11} /> Helpful {r.helpful_count ? `· ${r.helpful_count}` : ""}
                      </button>
                    </header>

                    {r.text && (
                      <p data-testid={`review-text-${r.id}`} className="font-body text-sm text-brand-text leading-relaxed whitespace-pre-line">
                        {r.text}
                      </p>
                    )}

                    {r.photos?.length > 0 && (
                      <div className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar">
                        {r.photos.map((p) => (
                          <img
                            key={p.id}
                            src={p.url}
                            alt=""
                            data-testid={`review-photo-${r.id}-${p.id}`}
                            className="w-20 h-20 rounded-lg object-cover border border-brand-border flex-shrink-0"
                          />
                        ))}
                      </div>
                    )}

                    {r.admin_response && (
                      <div data-testid={`review-response-${r.id}`} className="mt-3 ml-6 pl-3 border-l-2 border-brand-primary/40 bg-brand-primary/5 rounded-r-lg py-2 pr-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MessageSquare size={12} className="text-brand-primary" />
                          <span className="text-[11px] font-semibold text-brand-primary uppercase tracking-wider">Response from {r.admin_response.responded_by || "Manager"}</span>
                        </div>
                        <p className="font-body text-xs text-brand-text leading-relaxed whitespace-pre-line">{r.admin_response.text}</p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
