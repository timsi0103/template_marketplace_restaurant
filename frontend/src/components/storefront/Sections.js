import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { Star, Instagram, Twitter, Facebook, Mail, Phone, MapPin, ArrowRight } from "lucide-react";

const API = "/api";

export function AboutSection({ about }) {
  if (!about) return null;
  return (
    <section data-testid="about-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
        {about.team_image_url && (
          <img
            data-testid="about-image"
            src={about.team_image_url}
            alt="Our team"
            className="w-full h-72 sm:h-96 object-cover rounded-2xl"
          />
        )}
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-brand-primary font-semibold mb-3">About us</div>
          <h2 data-testid="about-heading" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text mb-4">{about.heading}</h2>
          <p className="font-body text-base text-brand-text leading-relaxed mb-4">{about.body}</p>
          {about.mission && (
            <blockquote className="border-l-2 border-brand-primary/40 pl-4 py-1 my-5 font-heading text-lg italic text-brand-text">
              “{about.mission}”
            </blockquote>
          )}
          {about.sourcing && (
            <div>
              <div className="text-xs uppercase tracking-wider text-brand-text-secondary font-semibold mb-1.5">Sourcing philosophy</div>
              <p className="font-body text-sm text-brand-text-secondary leading-relaxed">{about.sourcing}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function FeaturedCategories() {
  const [cats, setCats] = useState([]);
  useEffect(() => {
    axios.get(`${API}/categories/tree`).then(({ data }) => setCats(data.categories || [])).catch(() => {});
  }, []);
  if (cats.length === 0) return null;
  return (
    <section data-testid="featured-categories-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-brand-primary font-semibold mb-2">Menu</div>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">Featured categories</h2>
        </div>
        <Link to="/menu" className="hidden sm:inline-flex items-center gap-1 font-body text-sm font-semibold text-brand-primary hover:underline">
          Full menu <ArrowRight size={14} />
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {cats.slice(0, 4).map((c) => (
          <Link
            key={c.id}
            data-testid={`featured-cat-${c.slug}`}
            to={`/menu/${c.slug}`}
            className="group relative overflow-hidden rounded-2xl aspect-[4/5] bg-brand-surface"
          >
            {c.image && (
              <img
                src={c.image}
                alt={c.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 text-white">
              <div className="font-heading text-xl sm:text-2xl font-bold">{c.name}</div>
              <div className="text-xs sm:text-sm opacity-80 line-clamp-2">{c.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function SocialProofSection() {
  const [data, setData] = useState(null);
  useEffect(() => {
    axios.get(`${API}/storefront/social-proof`).then(({ data }) => setData(data)).catch(() => {});
  }, []);
  if (!data) return null;
  return (
    <section data-testid="social-proof-section" className="bg-brand-surface py-12 sm:py-16 border-y border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Headline KPI row */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-8 sm:mb-10">
          <div>
            <div className="inline-flex items-center gap-1.5 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={16} className="fill-amber-500 text-amber-500" />
              ))}
            </div>
            <div className="flex items-baseline gap-3">
              <div className="font-heading text-5xl font-bold text-brand-text leading-none" data-testid="social-avg-rating">{data.average_rating.toFixed(1)}</div>
              <div className="font-body text-sm text-brand-text-secondary">
                from <span className="font-semibold" data-testid="social-review-count">{data.review_count}</span> reviews
              </div>
            </div>
          </div>
          <div className="sm:text-right">
            <div className="font-heading text-3xl sm:text-4xl font-bold text-brand-primary leading-none" data-testid="social-total-orders">{data.total_orders.toLocaleString()}</div>
            <div className="text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold mt-1.5">orders served</div>
          </div>
        </div>

        {/* Reviews grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="social-reviews-list">
          {(data.featured_reviews || []).slice(0, 3).map((r, i) => (
            <div key={i} className="bg-white rounded-xl border border-brand-border p-5 flex flex-col" data-testid={`review-${i}`}>
              <div className="flex items-center gap-1.5 mb-2">
                {[...Array(r.rating)].map((_, j) => <Star key={j} size={12} className="fill-amber-500 text-amber-500" />)}
              </div>
              <blockquote className="font-body text-sm sm:text-base text-brand-text italic leading-relaxed flex-1">“{r.body}”</blockquote>
              <div className="mt-3 pt-3 border-t border-brand-border/60 text-xs text-brand-text-secondary">
                <span className="font-semibold text-brand-text">{r.author}</span>{r.dish && <> · <span className="italic">{r.dish}</span></>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BrandFooter({ storefront }) {
  if (!storefront) return null;
  const { social = {}, contact = {}, brand_name, logo_url } = storefront;
  const year = new Date().getFullYear();
  return (
    <footer data-testid="brand-footer" className="bg-[#1a1a1a] text-white/80 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          {logo_url ? (
            <img src={logo_url} alt={brand_name} className="h-10 mb-3" />
          ) : (
            <div className="font-heading text-xl font-bold text-white mb-3">{brand_name}</div>
          )}
          <p className="font-body text-sm opacity-70">{storefront.tagline}</p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider font-bold text-white/60 mb-3">Explore</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/menu" className="hover:text-white">Menu</Link></li>
            <li><Link to="/orders" className="hover:text-white">My orders</Link></li>
            <li><Link to="/search" className="hover:text-white">Search</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider font-bold text-white/60 mb-3">Contact</div>
          <ul className="space-y-2 text-sm">
            {contact.email && <li className="inline-flex items-center gap-1.5"><Mail size={12} /> <a href={`mailto:${contact.email}`} className="hover:text-white">{contact.email}</a></li>}
            {contact.phone && <li className="inline-flex items-center gap-1.5"><Phone size={12} /> {contact.phone}</li>}
            {contact.address && <li className="inline-flex items-start gap-1.5"><MapPin size={12} className="mt-0.5" /> {contact.address}</li>}
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider font-bold text-white/60 mb-3">Follow</div>
          <div className="flex items-center gap-3" data-testid="footer-socials">
            {social.instagram && <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white" aria-label="Instagram"><Instagram size={18} /></a>}
            {social.twitter && <a href={social.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-white" aria-label="Twitter"><Twitter size={18} /></a>}
            {social.facebook && <a href={social.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-white" aria-label="Facebook"><Facebook size={18} /></a>}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 sm:px-6 lg:px-8 py-4 text-xs text-white/50 flex flex-wrap items-center justify-between gap-2">
        <span>© {year} {brand_name}. All rights reserved.</span>
        <span>Crafted with care.</span>
      </div>
    </footer>
  );
}
