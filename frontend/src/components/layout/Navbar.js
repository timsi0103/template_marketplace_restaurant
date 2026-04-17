import { Link, useLocation } from "react-router-dom";
import { ShoppingBag, User } from "lucide-react";

export default function Navbar() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const isCheckout = location.pathname === "/checkout";

  if (isAdmin || isCheckout) return null;

  const navLinks = [
    { label: "Discover", path: "/" },
    { label: "Menu", path: "/menu" },
    { label: "Orders", path: "/orders" },
    { label: "Profile", path: "/loyalty" },
  ];

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <header
      data-testid="main-navbar"
      className="sticky top-0 z-50 bg-brand-bg/95 backdrop-blur-sm border-b border-brand-border"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            data-testid="navbar-logo"
            className="font-heading text-brand-primary text-xl sm:text-2xl font-semibold tracking-tight"
          >
            The Culinary Editorial
          </Link>

          {/* Nav Links */}
          <nav
            data-testid="navbar-links"
            className="hidden md:flex items-center gap-8"
          >
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                data-testid={`nav-link-${link.label.toLowerCase()}`}
                className={`font-body text-sm tracking-wide transition-colors duration-200 ${
                  isActive(link.path)
                    ? "text-brand-text underline underline-offset-4 decoration-brand-primary"
                    : "text-brand-text-secondary hover:text-brand-text"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Icons */}
          <div className="flex items-center gap-4">
            <Link
              to="/checkout"
              data-testid="navbar-cart-btn"
              className="text-brand-primary hover:text-brand-primary-hover transition-colors duration-200"
            >
              <ShoppingBag size={20} strokeWidth={1.8} />
            </Link>
            <Link
              to="/loyalty"
              data-testid="navbar-user-btn"
              className="text-brand-text hover:text-brand-primary transition-colors duration-200"
            >
              <User size={20} strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
