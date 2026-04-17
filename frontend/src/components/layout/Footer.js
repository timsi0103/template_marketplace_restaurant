import { Link, useLocation } from "react-router-dom";

export default function Footer() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  if (isAdmin) return null;

  return (
    <footer
      data-testid="main-footer"
      className="border-t border-brand-border bg-brand-bg mb-16 md:mb-0"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            to="/"
            data-testid="footer-logo"
            className="font-heading text-brand-primary text-lg font-semibold"
          >
            The Culinary Editorial
          </Link>

          <nav
            data-testid="footer-links"
            className="flex items-center gap-6"
          >
            {["Sourcing", "The Journal", "Privacy", "Shipping"].map((item) => (
              <span
                key={item}
                className="font-body text-xs tracking-widest uppercase text-brand-text-secondary hover:text-brand-text transition-colors cursor-pointer"
              >
                {item}
              </span>
            ))}
          </nav>

          <p className="font-body text-xs text-brand-text-secondary">
            &copy; 2024 The Culinary Editorial. Handcrafted for the Modern Epicurean.
          </p>
        </div>
      </div>
    </footer>
  );
}
