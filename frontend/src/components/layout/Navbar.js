import { Link, useLocation } from "react-router-dom";
import { ShoppingBag, User, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useStoreStatus } from "@/contexts/StoreStatusContext";
import { useState, useRef, useEffect } from "react";
import SearchBar from "@/components/SearchBar";

export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { itemCount, setDrawerOpen } = useCart();
  const { status: storeStatus } = useStoreStatus();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isAdmin = location.pathname.startsWith("/admin");
  const isCheckout = location.pathname === "/checkout";
  const isAuthPage = ["/login", "/signup", "/forgot-password", "/reset-password"].includes(location.pathname);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (isAdmin || isCheckout || isAuthPage) return null;

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

  const isLoggedIn = user && user !== false && user.role !== "guest";
  const displayName = isLoggedIn ? (user.name || user.email?.split("@")[0] || "User") : null;
  const initials = displayName ? displayName.charAt(0).toUpperCase() : "U";

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

          {/* Store Status */}
          {storeStatus && (
            <div data-testid="store-status-indicator" className="hidden md:flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${storeStatus.is_open ? "bg-green-500" : "bg-red-500"} ${storeStatus.is_open ? "" : "animate-pulse"}`} />
              <span className={`font-body text-xs font-medium ${storeStatus.is_open ? "text-green-600" : "text-red-500"}`}>
                {storeStatus.is_open ? "Open Now" : "Closed"}
              </span>
              {storeStatus.is_open && storeStatus.close_time && (
                <span className="font-body text-[10px] text-brand-text-secondary">&middot; Closes {storeStatus.close_time}</span>
              )}
              {!storeStatus.is_open && storeStatus.next_open && (
                <span className="font-body text-[10px] text-brand-text-secondary">&middot; Opens {storeStatus.next_open}</span>
              )}
            </div>
          )}


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

          {/* Right side: Search + Cart + User */}
          <div className="flex items-center gap-4">
            <SearchBar className="hidden md:block w-56 lg:w-64" />
            <button
              onClick={() => setDrawerOpen(true)}
              data-testid="navbar-cart-btn"
              className="relative text-brand-primary hover:text-brand-primary-hover transition-colors duration-200"
            >
              <ShoppingBag size={20} strokeWidth={1.8} />
              {itemCount > 0 && (
                <span
                  data-testid="navbar-cart-badge"
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-brand-orange text-white text-[9px] font-body font-bold rounded-full flex items-center justify-center"
                >
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
            </button>

            {isLoggedIn ? (
              /* Logged-in state: avatar + name dropdown */
              <div className="relative" ref={dropdownRef}>
                <button
                  data-testid="navbar-user-menu-btn"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 group"
                >
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={displayName}
                      data-testid="navbar-user-avatar"
                      className="w-8 h-8 rounded-full object-cover border-2 border-brand-border group-hover:border-brand-primary transition-colors"
                    />
                  ) : (
                    <div
                      data-testid="navbar-user-initials"
                      className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center"
                    >
                      <span className="text-white text-xs font-body font-semibold">
                        {initials}
                      </span>
                    </div>
                  )}
                  <span
                    data-testid="navbar-user-name"
                    className="hidden sm:inline font-body text-sm font-medium text-brand-text"
                  >
                    {displayName}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-brand-text-secondary transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {dropdownOpen && (
                  <div
                    data-testid="navbar-user-dropdown"
                    className="absolute right-0 top-full mt-2 w-52 bg-brand-surface border border-brand-border rounded-xl shadow-lg py-2 z-50"
                  >
                    <div className="px-4 py-2 border-b border-brand-border">
                      <p className="font-body text-sm font-medium text-brand-text truncate">
                        {displayName}
                      </p>
                      <p className="font-body text-xs text-brand-text-secondary truncate">
                        {user.email}
                      </p>
                    </div>
                    <Link
                      to="/loyalty"
                      data-testid="dropdown-profile-link"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 font-body text-sm text-brand-text hover:bg-brand-bg transition-colors"
                    >
                      My Profile
                    </Link>
                    <Link
                      to="/orders"
                      data-testid="dropdown-orders-link"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 font-body text-sm text-brand-text hover:bg-brand-bg transition-colors"
                    >
                      My Orders
                    </Link>
                    {user.role === "admin" && (
                      <Link
                        to="/admin"
                        data-testid="dropdown-admin-link"
                        onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-2 font-body text-sm text-brand-primary font-medium hover:bg-brand-bg transition-colors"
                      >
                        Admin Dashboard
                      </Link>
                    )}
                    <button
                      data-testid="dropdown-logout-btn"
                      onClick={() => {
                        setDropdownOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-4 py-2 font-body text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Not logged in: login/signup links */
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  data-testid="navbar-login-btn"
                  className="font-body text-sm text-brand-text-secondary hover:text-brand-text transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  data-testid="navbar-signup-btn"
                  className="hidden sm:inline-flex px-4 py-1.5 bg-brand-primary text-white font-body text-sm font-medium rounded-full hover:bg-brand-primary-hover transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
