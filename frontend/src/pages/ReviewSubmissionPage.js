import { useEffect, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Loader2, X, ImagePlus, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import StarRating from "@/components/reviews/StarRating";

const API = "/api";

export default function ReviewSubmissionPage() {
  const { order_id: orderId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [overallRating, setOverallRating] = useState(0);
  const [overallText, setOverallText] = useState("");
  const [itemRatings, setItemRatings] = useState({}); // item_id → { rating, text }
  const [photos, setPhotos] = useState([]); // [{id, url, filename}]
  const [anonymous, setAnonymous] = useState(false);
  const [contactEmail, setContactEmail] = useState(params.get("email") || "");
  const [submitting, setSubmitting] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [submittedState, setSubmittedState] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/reviews/request/${orderId}`);
        setRequest(data);
        if (data.submitted) {
          setSubmittedState({ already: true });
        }
      } catch (e) {
        setError(e?.response?.data?.detail || "Couldn't load this order.");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  async function uploadPhoto(file) {
    if (!file) return;
    if (photos.length >= 5) {
      toast.error("You can attach up to 5 photos");
      return;
    }
    setPhotoUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("order_id", orderId);
    if (contactEmail) formData.append("contact_email", contactEmail);
    try {
      const { data } = await axios.post(`${API}/reviews/photos/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });
      setPhotos((p) => [...p, data]);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail === "Email verification required") {
        toast.error("Please enter the email used for the order below to verify.");
      } else {
        toast.error(detail || "Photo upload failed");
      }
    } finally {
      setPhotoUploading(false);
    }
  }

  function removePhoto(idx) {
    setPhotos((p) => p.filter((_, i) => i !== idx));
  }

  function setItemRating(itemId, rating) {
    setItemRatings((p) => ({ ...p, [itemId]: { ...(p[itemId] || {}), rating } }));
  }
  function setItemText(itemId, text) {
    setItemRatings((p) => ({ ...p, [itemId]: { ...(p[itemId] || {}), text } }));
  }

  async function submit() {
    if (!overallRating) {
      toast.error("Please tap an overall rating first");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        order_id: orderId,
        overall_rating: overallRating,
        overall_text: overallText,
        item_reviews: Object.entries(itemRatings)
          .filter(([, v]) => v?.rating)
          .map(([item_id, v]) => ({ item_id, rating: v.rating, text: v.text || "" })),
        photos: photos.map((p) => p.id),
        anonymous,
        contact_email: contactEmail || undefined,
      };
      const { data } = await axios.post(`${API}/reviews`, body, { withCredentials: true });
      setSubmittedState({ submitted: true, ...data });
      toast.success("Thanks for your feedback!");
    } catch (e) {
      const detail = e?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Could not submit review");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div data-testid="review-page-loading" className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-primary" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div data-testid="review-page-error" className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="font-heading text-2xl font-bold text-brand-text mb-2">Can't load order</h1>
          <p className="text-sm text-brand-text-secondary mb-6">{error || "Order not found."}</p>
          <Link to="/menu" className="inline-block px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full">Back to menu</Link>
        </div>
      </div>
    );
  }

  if (submittedState) {
    return (
      <div data-testid="review-submitted-state" className="min-h-screen flex items-center justify-center px-4 bg-brand-bg">
        <div className="max-w-md text-center p-8 bg-brand-surface border border-brand-border rounded-2xl">
          <div className="w-14 h-14 mx-auto bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 size={24} />
          </div>
          <h1 className="font-heading text-2xl font-bold text-brand-text">
            {submittedState.already ? "You've already reviewed this order" : "Thanks — you're the best."}
          </h1>
          <p className="text-sm text-brand-text-secondary mt-2">
            Your feedback helps our kitchen get even better.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link to="/menu" className="px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full">Back to menu</Link>
            <Link to={`/orders/track/${orderId}`} className="text-xs text-brand-text-secondary underline">View order status</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!request.eligible) {
    return (
      <div data-testid="review-not-eligible" className="min-h-screen flex items-center justify-center px-4 bg-brand-bg">
        <div className="max-w-md text-center p-8 bg-brand-surface border border-brand-border rounded-2xl">
          <h1 className="font-heading text-2xl font-bold text-brand-text">Not ready yet</h1>
          <p className="text-sm text-brand-text-secondary mt-2">
            {request.seconds_until_prompt > 0
              ? "We'll invite you to review this order shortly after it's delivered."
              : "This order can't be reviewed yet."}
          </p>
          <Link to={`/orders/track/${orderId}`} className="mt-6 inline-block px-6 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full">Track order</Link>
        </div>
      </div>
    );
  }

  const needsEmailVerification = !(user?.email);

  return (
    <div data-testid="review-submission-page" className="min-h-screen bg-brand-bg py-8 sm:py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to={`/orders/track/${orderId}`} className="inline-flex items-center gap-2 text-sm text-brand-text-secondary hover:text-brand-text mb-5">
          <ArrowLeft size={14} /> Back to order
        </Link>

        <header className="mb-6">
          <div className="text-[10px] uppercase tracking-widest text-brand-text-secondary font-semibold">Order {request.order_number}</div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-brand-text mt-1">Rate your order</h1>
          <p className="text-sm text-brand-text-secondary mt-1">{request.message_template}</p>
        </header>

        {/* Overall */}
        <section className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6 mb-5">
          <h2 className="font-heading text-base font-bold text-brand-text mb-2">Overall experience</h2>
          <div data-testid="overall-rating" className="py-2">
            <StarRating value={overallRating} onChange={setOverallRating} size={36} testIdPrefix="overall-star" />
          </div>
          <Textarea
            data-testid="overall-text"
            placeholder="Tell us what made it great (or what to improve)"
            value={overallText}
            onChange={(e) => setOverallText(e.target.value)}
            className="mt-3 bg-brand-bg border-brand-border text-sm resize-none min-h-[100px]"
            maxLength={2000}
          />
          <div className="text-[10px] text-brand-text-secondary text-right mt-1">{overallText.length}/2000</div>
        </section>

        {/* Per-item ratings */}
        {request.items?.length > 0 && (
          <section data-testid="per-item-section" className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6 mb-5">
            <h2 className="font-heading text-base font-bold text-brand-text mb-1">Rate individual items <span className="text-xs font-body font-normal text-brand-text-secondary">(optional)</span></h2>
            <p className="text-xs text-brand-text-secondary mb-4">Specific feedback makes the biggest impact.</p>
            <div className="space-y-3">
              {request.items.map((it) => (
                <div key={it.item_id} data-testid={`item-rating-${it.item_id}`} className="flex items-start gap-3 p-3 rounded-xl bg-brand-bg/50 border border-brand-border">
                  {it.image && (
                    <img src={it.image} alt={it.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-body text-sm font-semibold text-brand-text truncate">{it.name}</div>
                    <StarRating
                      value={itemRatings[it.item_id]?.rating || 0}
                      onChange={(v) => setItemRating(it.item_id, v)}
                      size={18}
                      testIdPrefix={`item-star-${it.item_id}`}
                    />
                    {itemRatings[it.item_id]?.rating > 0 && (
                      <Input
                        data-testid={`item-text-${it.item_id}`}
                        placeholder="Quick note about this dish…"
                        value={itemRatings[it.item_id]?.text || ""}
                        onChange={(e) => setItemText(it.item_id, e.target.value)}
                        className="mt-2 h-9 text-sm bg-brand-surface border-brand-border"
                        maxLength={500}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Photos */}
        {request.allow_photos && (
          <section data-testid="photos-section" className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6 mb-5">
            <h2 className="font-heading text-base font-bold text-brand-text mb-1">Add photos <span className="text-xs font-body font-normal text-brand-text-secondary">(optional, up to 5)</span></h2>
            <p className="text-xs text-brand-text-secondary mb-3">Show off the dish — photos help other diners pick what to order.</p>
            <div className="flex flex-wrap gap-3">
              {photos.map((p, idx) => (
                <div key={p.id} data-testid={`photo-${idx}`} className="relative">
                  <img src={p.url} alt="" className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover border border-brand-border" />
                  <button
                    type="button"
                    data-testid={`photo-remove-${idx}`}
                    onClick={() => removePhoto(idx)}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm hover:bg-red-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {photos.length < 5 && (
                <label
                  data-testid="photo-add-btn"
                  className={`w-20 h-20 sm:w-24 sm:h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-brand-text-secondary hover:border-brand-primary hover:text-brand-primary cursor-pointer transition-colors ${photoUploading ? "pointer-events-none opacity-60" : ""}`}
                >
                  {photoUploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={18} />}
                  <span className="text-[10px] font-body mt-1">Add photo</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadPhoto(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </section>
        )}

        {/* Anonymous / guest */}
        <section className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6 mb-5">
          {needsEmailVerification && (
            <div className="mb-4">
              <Label className="text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Email used on the order</Label>
              <Input
                data-testid="contact-email-input"
                type="email"
                placeholder="you@example.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="mt-1.5 h-10 text-sm bg-brand-bg border-brand-border"
              />
              <p className="text-[11px] text-brand-text-secondary mt-1">
                We use this to confirm this was your order. It won't be displayed.
              </p>
            </div>
          )}
          {request.allow_anonymous && (
            <div data-testid="anonymous-row" className="flex items-start justify-between gap-4">
              <div>
                <div className="font-body text-sm font-semibold text-brand-text inline-flex items-center gap-1.5">
                  {anonymous ? <EyeOff size={14} /> : <Eye size={14} />}
                  Submit anonymously
                </div>
                <div className="text-[11px] text-brand-text-secondary mt-0.5">Your name won't appear on the public review.</div>
              </div>
              <Switch data-testid="anonymous-switch" checked={anonymous} onCheckedChange={setAnonymous} />
            </div>
          )}
        </section>

        <button
          data-testid="submit-review-btn"
          onClick={submit}
          disabled={submitting || !overallRating}
          className="w-full px-6 py-3.5 rounded-full bg-brand-primary text-white font-body text-sm font-semibold hover:bg-brand-primary-hover disabled:opacity-50 transition-colors"
        >
          {submitting ? <Loader2 size={14} className="animate-spin inline mr-1.5" /> : null}
          {submitting ? "Submitting…" : "Submit review"}
        </button>
      </div>
    </div>
  );
}
