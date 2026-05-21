import { Link, useLocation } from "react-router-dom";
import { MapPin, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { useStorefront } from "@/hooks/useStorefront";

const shopLinks = [
  { label: "Full Menu", path: "/menu" },
  { label: "Starters", path: "/menu/starters" },
  { label: "Mains", path: "/menu/mains" },
  { label: "Drinks", path: "/menu/drinks" },
  { label: "Desserts", path: "/menu/desserts" },
];

const companyLinks = [
  { label: "Our Story" },
  { label: "The Journal" },
  { label: "Sourcing Philosophy" },
  { label: "Careers" },
  { label: "Press" },
];

const supportLinks = [
  { label: "Help Centre" },
  { label: "Shipping & Delivery" },
  { label: "Returns & Refunds" },
  { label: "Privacy Policy" },
  { label: "Terms of Service" },
];

const SOCIAL_FALLBACKS = {
  instagram: "https://instagram.com/culinaryeditorial",
  twitter: "https://x.com/culinaryedit",
  facebook: "https://facebook.com/culinaryeditorial",
  pinterest: "https://pinterest.com/culinaryeditorial",
};

export default function Footer() {
  const location = useLocation();
  const storefront = useStorefront();
  const isAdmin = location.pathname.startsWith("/admin");

  if (isAdmin) return null;

  const socialUrl = (key) =>
    storefront?.social?.[key]?.trim() || SOCIAL_FALLBACKS[key] || "";

  const notReady = (label) =>
    toast(`${label} — coming soon`, { description: "We're polishing this page. It'll be live shortly." });

  return (
    <footer data-testid="main-footer" className="bg-brand-text mb-16 md:mb-0">
      {/* Main Footer Grid */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand Column */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-2">
            <Link to="/" data-testid="footer-logo" className="inline-block">
              <h2 className="font-heading text-2xl font-bold text-white">
                The Culinary Editorial
              </h2>
            </Link>
            <p className="font-body text-sm text-white/50 mt-3 leading-relaxed max-w-xs">
              Handcrafted for the Modern Epicurean. We curate the finest culinary experiences from artisan kitchens and deliver them to your table.
            </p>
            <div className="mt-6 space-y-3">
              <div className="flex items-start gap-2.5">
                <MapPin size={14} className="text-brand-orange mt-0.5 flex-shrink-0" />
                <span className="font-body text-xs text-white/50">
                  42 Epicurean Way, Soho<br />New York, NY 10012
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone size={14} className="text-brand-orange flex-shrink-0" />
                <span className="font-body text-xs text-white/50">+1 (212) 555-0187</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail size={14} className="text-brand-orange flex-shrink-0" />
                <span className="font-body text-xs text-white/50">hello@culinaryeditorial.com</span>
              </div>
            </div>
          </div>

          {/* Shop Links */}
          <div>
            <h4 className="font-heading text-sm font-bold text-white uppercase tracking-widest mb-5">
              Shop
            </h4>
            <ul className="space-y-3">
              {shopLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.path}
                    data-testid={`footer-shop-${link.path.replace(/\//g, '-')}`}
                    className="font-body text-sm text-white/50 hover:text-brand-orange transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-heading text-sm font-bold text-white uppercase tracking-widest mb-5">
              Company
            </h4>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <button
                    type="button"
                    data-testid={`footer-company-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => notReady(link.label)}
                    className="font-body text-sm text-white/50 hover:text-brand-orange transition-colors duration-200 cursor-pointer text-left"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="font-heading text-sm font-bold text-white uppercase tracking-widest mb-5">
              Support
            </h4>
            <ul className="space-y-3">
              {supportLinks.map((link) => (
                <li key={link.label}>
                  <button
                    type="button"
                    data-testid={`footer-support-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => notReady(link.label)}
                    className="font-body text-sm text-white/50 hover:text-brand-orange transition-colors duration-200 cursor-pointer text-left"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Social Icons */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div data-testid="footer-social" className="flex items-center gap-4">
            {/* Instagram */}
            <a href={socialUrl("instagram")} target="_blank" rel="noopener noreferrer" data-testid="social-instagram" aria-label="Instagram" className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:text-brand-orange hover:border-brand-orange transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
            </a>
            {/* Twitter/X */}
            <a href={socialUrl("twitter")} target="_blank" rel="noopener noreferrer" data-testid="social-twitter" aria-label="X / Twitter" className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:text-brand-orange hover:border-brand-orange transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            {/* Facebook */}
            <a href={socialUrl("facebook")} target="_blank" rel="noopener noreferrer" data-testid="social-facebook" aria-label="Facebook" className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:text-brand-orange hover:border-brand-orange transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            {/* Pinterest */}
            <a href={socialUrl("pinterest")} target="_blank" rel="noopener noreferrer" data-testid="social-pinterest" aria-label="Pinterest" className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:text-brand-orange hover:border-brand-orange transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0a12 12 0 0 0-4.373 23.178c-.07-.623-.133-1.582.028-2.264l1.155-4.894s-.295-.59-.295-1.462c0-1.37.795-2.393 1.784-2.393.841 0 1.247.632 1.247 1.389 0 .846-.538 2.11-.816 3.282-.232.98.491 1.779 1.457 1.779 1.749 0 3.092-1.844 3.092-4.503 0-2.354-1.692-3.998-4.11-3.998-2.799 0-4.442 2.1-4.442 4.268 0 .845.326 1.752.733 2.244a.294.294 0 0 1 .068.282l-.273 1.115c-.043.183-.145.222-.334.134-1.249-.581-2.03-2.406-2.03-3.874 0-3.154 2.291-6.05 6.608-6.05 3.469 0 6.165 2.472 6.165 5.776 0 3.447-2.173 6.22-5.19 6.22-1.013 0-1.966-.527-2.292-1.148l-.623 2.378c-.226.869-.835 1.958-1.243 2.622A12 12 0 1 0 12 0z"/></svg>
            </a>
          </div>

          {/* Payment Methods */}
          <div data-testid="footer-payments" className="flex items-center gap-3">
            <span className="font-body text-[10px] text-white/30 uppercase tracking-widest mr-1">We accept</span>
            {["Visa", "MC", "Amex", "Apple Pay"].map((m) => (
              <span key={m} className="px-2.5 py-1.5 bg-white/10 rounded font-body text-[10px] text-white/60 font-medium">
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-body text-[11px] text-white/30">
            &copy; {new Date().getFullYear()} The Culinary Editorial. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            {["Privacy Policy", "Terms of Service", "Cookie Preferences", "Accessibility"].map((link) => (
              <span key={link} className="font-body text-[11px] text-white/30 hover:text-white/60 transition-colors cursor-pointer">
                {link}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
