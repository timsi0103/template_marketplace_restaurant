import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Users,
  Settings,
  Plus,
  Pencil,
  BarChart3,
  ArrowRight,
  Clock,
  Check,
  MoreHorizontal,
  Filter,
} from "lucide-react";

const sidebarLinks = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Inventory", icon: Package, active: false },
  { label: "Orders", icon: ClipboardList, active: false },
  { label: "Customers", icon: Users, active: false },
  { label: "Settings", icon: Settings, active: false },
];

const queueItems = [
  {
    id: 104,
    type: "Table 12",
    items: "2 items",
    details: "Scallop Crudo, Wagyu Tartare",
    time: "4m ago",
    status: "READY TO SERVE",
    statusColor: "text-green-600",
    borderClass: "queue-orange",
  },
  {
    id: 105,
    type: "Delivery",
    items: "4 items",
    details: "Truffle Risotto (2), Branzino, Caviar",
    time: "12m ago",
    status: "IN PREPARATION",
    statusColor: "text-brand-text-secondary",
    borderClass: "queue-orange",
  },
  {
    id: 106,
    type: "Table 4",
    items: "1 item",
    details: "Chef's Tasting Menu",
    time: "Just Now",
    status: "NEW ORDER",
    statusColor: "text-brand-orange",
    borderClass: "queue-red",
  },
];

export default function AdminDashboard() {
  const [activeLink, setActiveLink] = useState("Dashboard");

  return (
    <div data-testid="admin-dashboard" className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        data-testid="admin-sidebar"
        className="hidden lg:flex flex-col w-56 bg-brand-bg border-r border-brand-border"
      >
        <div className="p-6">
          <h2 className="font-heading text-lg font-bold text-brand-primary">
            Admin Panel
          </h2>
          <p className="font-body text-xs text-brand-text-secondary mt-0.5">
            Curation Control
          </p>
        </div>

        <nav data-testid="admin-nav" className="flex-1 px-3">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            const isActive = activeLink === link.label;
            return (
              <button
                key={link.label}
                data-testid={`admin-nav-${link.label.toLowerCase()}`}
                onClick={() => setActiveLink(link.label)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-body text-sm transition-colors mb-1 ${
                  isActive
                    ? "text-brand-primary font-semibold bg-brand-surface"
                    : "text-brand-text-secondary hover:text-brand-text hover:bg-brand-surface/50"
                }`}
              >
                <Icon size={18} />
                {link.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-brand-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-border flex items-center justify-center">
              <Users size={16} className="text-brand-text-secondary" />
            </div>
            <div>
              <p className="font-body text-sm font-medium text-brand-text">Chef Administrator</p>
              <p className="font-body text-xs text-brand-text-secondary">Owner</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-brand-surface overflow-auto">
        <div className="p-6 lg:p-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1
                data-testid="dashboard-title"
                className="font-heading text-3xl sm:text-4xl font-bold text-brand-text tracking-tight"
              >
                Dashboard
              </h1>
              <p className="font-body text-sm text-brand-text-secondary mt-1">
                Good morning, Chef. Here's today's curation overview.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                data-testid="add-new-item-btn"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white font-body text-sm font-medium rounded-lg hover:bg-brand-primary-hover transition-colors"
              >
                <Plus size={16} /> Add New Item
              </button>
              <button
                data-testid="edit-menu-btn"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-surface text-brand-text font-body text-sm font-medium rounded-lg border border-brand-border hover:bg-brand-bg transition-colors"
              >
                <Pencil size={16} /> Edit Menu
              </button>
            </div>
          </div>

          {/* View Analytics link */}
          <div className="mb-8">
            <button
              data-testid="view-analytics-btn"
              className="inline-flex items-center gap-2 font-body text-sm font-medium text-brand-text hover:text-brand-primary transition-colors"
            >
              <BarChart3 size={16} /> View Analytics
            </button>
          </div>

          {/* Stats Cards */}
          <div
            data-testid="stats-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10"
          >
            {/* Revenue Card */}
            <div
              data-testid="revenue-card"
              className="bg-brand-surface border border-brand-border rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">
                  Daily Revenue
                </span>
                <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center">
                  <BarChart3 size={14} className="text-brand-orange" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-3xl font-bold text-brand-text">
                  $4,285
                </span>
                <span className="font-body text-xs font-medium text-green-600">
                  +12%
                </span>
              </div>
              {/* Mini chart placeholder */}
              <div className="flex items-end gap-1.5 mt-4 h-12">
                {[30, 40, 35, 45, 55, 70, 65].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${h}%`,
                      backgroundColor: i >= 5 ? "#6E1C1E" : "#E5E0D8",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Active Orders Card */}
            <div
              data-testid="active-orders-card"
              className="bg-brand-surface border border-brand-border rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">
                  Active Orders
                </span>
                <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center">
                  <ClipboardList size={14} className="text-brand-orange" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-3xl font-bold text-brand-text">
                  24
                </span>
                <span className="font-body text-xs font-medium text-brand-orange">
                  Surging
                </span>
              </div>
              <div className="flex gap-2 mt-4">
                {[
                  { label: "12 Prep", color: "bg-brand-border" },
                  { label: "8 Ready", color: "bg-brand-border" },
                  { label: "4 Delayed", color: "bg-brand-orange/20 text-brand-orange" },
                ].map((s) => (
                  <span
                    key={s.label}
                    className={`px-2.5 py-1 rounded font-body text-[10px] font-medium ${s.color} text-brand-text-secondary`}
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Top Selling Item */}
            <div
              data-testid="top-selling-card"
              className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden"
            >
              <div className="relative h-28">
                <img
                  src="https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=400&h=200&fit=crop"
                  alt="Top selling"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent" />
                <span className="absolute top-3 left-3 font-body text-[10px] uppercase tracking-widest text-white/80">
                  Top Selling Item
                </span>
              </div>
              <div className="p-4">
                <span className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">
                  Top Curation
                </span>
                <h3 className="font-heading text-lg font-bold text-brand-text mt-1">
                  Truffle Risotto
                </h3>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-heading text-base font-bold text-brand-primary">
                    86 Served
                  </span>
                  <ArrowRight size={16} className="text-brand-text-secondary" />
                </div>
              </div>
            </div>
          </div>

          {/* Live Service Queue */}
          <div
            data-testid="service-queue"
            className="bg-brand-surface border border-brand-border rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-heading text-xl font-bold text-brand-text">
                  Live Service Queue
                </h2>
                <p className="font-body text-sm text-brand-text-secondary mt-0.5">
                  Real-time order orchestration.
                </p>
              </div>
              <button
                data-testid="queue-filter-btn"
                className="w-9 h-9 rounded-lg border border-brand-border flex items-center justify-center hover:bg-brand-bg transition-colors"
              >
                <Filter size={16} className="text-brand-text-secondary" />
              </button>
            </div>

            <div className="space-y-3">
              {queueItems.map((item) => (
                <div
                  key={item.id}
                  data-testid={`queue-item-${item.id}`}
                  className={`flex items-center justify-between p-4 rounded-xl bg-brand-bg border-l-[3px] ${
                    item.status === "NEW ORDER"
                      ? "border-l-brand-orange"
                      : item.status === "READY TO SERVE"
                      ? "border-l-green-500"
                      : "border-l-brand-border"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`font-heading text-lg font-bold ${
                      item.status === "NEW ORDER" ? "text-brand-orange" : "text-brand-text"
                    }`}>
                      #{item.id}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-body text-sm font-semibold text-brand-text">
                          {item.type}
                        </span>
                        <span className="font-body text-xs text-brand-text-secondary">
                          {item.items}
                        </span>
                      </div>
                      <p className="font-body text-xs text-brand-text-secondary mt-0.5">
                        {item.details}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-brand-text-secondary">
                      <Clock size={12} />
                      <span className={`font-body text-xs ${
                        item.status === "NEW ORDER" ? "text-brand-orange font-medium" : ""
                      }`}>
                        {item.time}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded font-body text-[10px] font-semibold uppercase tracking-wider ${
                        item.status === "READY TO SERVE"
                          ? "bg-green-50 text-green-600"
                          : item.status === "NEW ORDER"
                          ? "bg-brand-orange/10 text-brand-orange"
                          : "bg-brand-bg text-brand-text-secondary border border-brand-border"
                      }`}
                    >
                      {item.status}
                    </span>
                    {item.status === "READY TO SERVE" ? (
                      <button
                        data-testid={`queue-complete-${item.id}`}
                        className="w-8 h-8 rounded-lg bg-brand-primary text-white flex items-center justify-center hover:bg-brand-primary-hover transition-colors"
                      >
                        <Check size={14} />
                      </button>
                    ) : (
                      <button
                        data-testid={`queue-more-${item.id}`}
                        className="w-8 h-8 rounded-lg bg-brand-border/50 flex items-center justify-center hover:bg-brand-border transition-colors"
                      >
                        <MoreHorizontal size={14} className="text-brand-text-secondary" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
