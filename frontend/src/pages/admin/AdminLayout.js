import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { LayoutDashboard, Package, ClipboardList, Users, Settings, LogOut, FolderTree, SlidersHorizontal, Layers, Clock, Ticket, ChefHat, Printer, History, BarChart3, Zap, Gauge, Ban, Palette, Filter, MapPin, Receipt, FileText, Search, XCircle, UserCog, Shield, Star, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const sidebarLinks = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "Catalog", path: "/admin/catalog", icon: Package },
  { label: "Categories", path: "/admin/categories", icon: FolderTree },
  { label: "Variants", path: "/admin/variants", icon: Layers },
  { label: "Modifiers", path: "/admin/modifiers", icon: SlidersHorizontal },
  { label: "Hours", path: "/admin/hours", icon: Clock },
  { label: "Coupons", path: "/admin/coupons", icon: Ticket },
  { label: "Kitchen (KDS)", path: "/admin/kds-settings", icon: ChefHat },
  { label: "Live Queue", path: "/admin/queue", icon: Zap },
  { label: "Prep & Throttle", path: "/admin/throttle", icon: Gauge },
  { label: "86 / Sold-Out", path: "/admin/86", icon: Ban },
  { label: "Storefront", path: "/admin/storefront", icon: Palette },
  { label: "Store Profile", path: "/admin/store-profile", icon: MapPin },
  { label: "Tax & Charges", path: "/admin/fees", icon: Receipt },
  { label: "Menu & Search", path: "/admin/catalog-settings", icon: Filter },
  { label: "Orders", path: "/admin/orders", icon: ClipboardList },
  { label: "Cancellations", path: "/admin/cancellations", icon: XCircle },
  { label: "Printers", path: "/admin/printers", icon: Printer },
  { label: "Print Settings", path: "/admin/print-settings", icon: Settings },
  { label: "Print History", path: "/admin/print-jobs", icon: History },
  { label: "Analytics", path: "/admin/analytics", icon: BarChart3 },
  { label: "Daily Summary", path: "/admin/daily-summary", icon: FileText },
  { label: "SEO", path: "/admin/seo", icon: Search },
  { label: "Staff", path: "/admin/staff", icon: UserCog },
  { label: "Roles", path: "/admin/roles", icon: Shield },
  { label: "Reviews", path: "/admin/reviews", icon: Star },
  { label: "Customers", path: "/admin/customers", icon: Users },
  { label: "Settings", path: "/admin/settings", icon: Settings },
];

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user === false)) {
      navigate("/login", { replace: true });
    } else if (!loading && user && user.role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [mobileOpen]);

  if (loading || !user || user === false || user.role !== "admin") {
    return (
      <div data-testid="admin-loading" className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isActive = (path) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  const SidebarContent = ({ mobile = false }) => (
    <>
      <div className={mobile ? "p-5 flex items-center justify-between" : "p-6"}>
        <div>
          <Link to="/admin" className="font-heading text-lg font-bold text-brand-primary">Admin Panel</Link>
          <p className="font-body text-xs text-brand-text-secondary mt-0.5">Curation Control</p>
        </div>
        {mobile && (
          <button
            data-testid="admin-mobile-close-btn"
            onClick={() => setMobileOpen(false)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-brand-text-secondary hover:bg-brand-surface"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <nav data-testid={mobile ? "admin-mobile-nav" : "admin-nav"} className="flex-1 px-3 overflow-y-auto">
        {sidebarLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.path);
          return (
            <Link
              key={link.label}
              to={link.path}
              data-testid={`admin-nav-${link.label.toLowerCase()}`}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-body text-sm transition-colors mb-1 ${active ? "text-brand-primary font-semibold bg-brand-surface" : "text-brand-text-secondary hover:text-brand-text hover:bg-brand-surface/50"}`}
            >
              <Icon size={18} />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-brand-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-primary flex items-center justify-center">
            <span className="text-white text-xs font-body font-semibold">{user.name?.charAt(0) || "A"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-sm font-medium text-brand-text truncate">{user.name}</p>
            <p className="font-body text-xs text-brand-text-secondary">Admin</p>
          </div>
        </div>
        <button
          data-testid="admin-logout-btn"
          onClick={logout}
          className="mt-3 w-full flex items-center gap-2 px-4 py-2 rounded-lg font-body text-xs text-brand-text-secondary hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div data-testid="admin-layout" className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside data-testid="admin-sidebar" className="hidden lg:flex flex-col w-56 bg-brand-bg border-r border-brand-border flex-shrink-0 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile topbar */}
      <header data-testid="admin-mobile-topbar" className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-brand-bg border-b border-brand-border flex items-center justify-between px-4 h-14">
        <button
          data-testid="admin-mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-brand-text hover:bg-brand-surface"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <Link to="/admin" className="font-heading text-base font-bold text-brand-primary">Admin Panel</Link>
        <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-body font-semibold">{user.name?.charAt(0) || "A"}</span>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            data-testid="admin-mobile-backdrop"
            className="lg:hidden fixed inset-0 z-50 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            data-testid="admin-mobile-drawer"
            className="lg:hidden fixed top-0 bottom-0 left-0 z-50 w-72 max-w-[85vw] bg-brand-bg border-r border-brand-border flex flex-col animate-slide-in-left"
          >
            <SidebarContent mobile />
          </aside>
        </>
      )}

      <main className="flex-1 bg-brand-surface overflow-auto pt-14 lg:pt-0 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
