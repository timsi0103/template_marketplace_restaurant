import { Link, useLocation } from "react-router-dom";
import { Compass, UtensilsCrossed, ClipboardList, User } from "lucide-react";

const tabs = [
  { label: "Discover", path: "/", icon: Compass },
  { label: "Menu", path: "/menu", icon: UtensilsCrossed },
  { label: "Orders", path: "/orders", icon: ClipboardList },
  { label: "Profile", path: "/loyalty", icon: User },
];

export default function BottomNav() {
  const location = useLocation();

  const isHidden =
    location.pathname.startsWith("/admin") ||
    location.pathname === "/checkout" ||
    location.pathname === "/kitchen" ||
    ["/login", "/signup", "/forgot-password", "/reset-password"].includes(location.pathname);

  if (isHidden) return null;

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      data-testid="bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-brand-surface/95 backdrop-blur-md border-t border-brand-border safe-area-bottom"
    >
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              data-testid={`bottom-nav-${tab.label.toLowerCase()}`}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 min-w-[64px] transition-colors ${
                active ? "text-brand-primary" : "text-brand-text-secondary"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.6} />
              <span className={`font-body text-[10px] ${active ? "font-semibold" : "font-normal"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
