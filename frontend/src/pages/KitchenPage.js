import { useState } from "react";
import {
  ChefHat,
  Clock,
  Flame,
  AlertTriangle,
  CheckCircle,
  Timer,
  Filter,
} from "lucide-react";

const kitchenOrders = [
  {
    id: 201,
    table: "Table 7",
    items: ["Truffle Tagliatelle", "Heirloom Burrata"],
    time: "3m",
    priority: "high",
    status: "cooking",
  },
  {
    id: 202,
    table: "Delivery #89",
    items: ["Heritage Duck Breast", "Earth Harvest Bowl", "Ganache Tart"],
    time: "8m",
    priority: "medium",
    status: "prepping",
  },
  {
    id: 203,
    table: "Table 2",
    items: ["Artisan Diavola"],
    time: "12m",
    priority: "low",
    status: "ready",
  },
  {
    id: 204,
    table: "Pickup #45",
    items: ["Matcha Mille Crepe x2", "Reserve Cold Brew"],
    time: "1m",
    priority: "urgent",
    status: "new",
  },
];

const statusConfig = {
  new: { label: "New", bg: "bg-brand-orange/10", text: "text-brand-orange", icon: AlertTriangle },
  cooking: { label: "Cooking", bg: "bg-yellow-50", text: "text-yellow-600", icon: Flame },
  prepping: { label: "Prepping", bg: "bg-blue-50", text: "text-blue-600", icon: Timer },
  ready: { label: "Ready", bg: "bg-green-50", text: "text-green-600", icon: CheckCircle },
};

export default function KitchenPage() {
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered =
    filterStatus === "all"
      ? kitchenOrders
      : kitchenOrders.filter((o) => o.status === filterStatus);

  return (
    <div data-testid="kitchen-page" className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <div className="flex items-center gap-3 mb-2">
          <ChefHat size={28} className="text-brand-primary" />
          <h1
            data-testid="kitchen-title"
            className="font-heading text-4xl sm:text-5xl font-bold text-brand-text tracking-tight"
          >
            Kitchen Operations
          </h1>
        </div>
        <p className="font-body text-sm text-brand-text-secondary mb-8">
          Real-time kitchen display system. Manage prep, cooking, and dispatch.
        </p>

        {/* Stats Row */}
        <div
          data-testid="kitchen-stats"
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: "In Queue", value: "12", icon: Clock, color: "text-brand-text" },
            { label: "Cooking", value: "5", icon: Flame, color: "text-yellow-600" },
            { label: "Ready", value: "3", icon: CheckCircle, color: "text-green-600" },
            { label: "Avg Time", value: "18m", icon: Timer, color: "text-brand-primary" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                data-testid={`kitchen-stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="bg-brand-surface border border-brand-border rounded-xl p-4"
              >
                <Icon size={16} className={`${stat.color} mb-2`} />
                <p className="font-heading text-2xl font-bold text-brand-text">
                  {stat.value}
                </p>
                <p className="font-body text-xs text-brand-text-secondary">
                  {stat.label}
                </p>
              </div>
            );
          })}
        </div>

        {/* Filter Buttons */}
        <div data-testid="kitchen-filters" className="flex flex-wrap gap-2 mb-6">
          {["all", "new", "prepping", "cooking", "ready"].map((status) => (
            <button
              key={status}
              data-testid={`kitchen-filter-${status}`}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-1.5 rounded-full font-body text-xs font-medium border transition-all duration-200 capitalize ${
                filterStatus === status
                  ? "bg-brand-primary text-white border-brand-primary"
                  : "bg-transparent text-brand-text-secondary border-brand-border hover:border-brand-text"
              }`}
            >
              {status === "all" ? "All Orders" : status}
            </button>
          ))}
        </div>

        {/* Orders List */}
        <div data-testid="kitchen-orders" className="space-y-3">
          {filtered.map((order) => {
            const config = statusConfig[order.status];
            const StatusIcon = config.icon;
            return (
              <div
                key={order.id}
                data-testid={`kitchen-order-${order.id}`}
                className={`bg-brand-surface border border-brand-border rounded-xl p-5 flex items-start justify-between ${
                  order.priority === "urgent" ? "border-l-4 border-l-brand-orange" : ""
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-heading text-lg font-bold text-brand-text">
                      #{order.id}
                    </span>
                    <span className="font-body text-sm font-medium text-brand-text">
                      {order.table}
                    </span>
                    {order.priority === "urgent" && (
                      <span className="px-2 py-0.5 bg-brand-orange text-white text-[10px] font-body font-semibold uppercase tracking-wider rounded">
                        Urgent
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {order.items.map((item) => (
                      <span
                        key={item}
                        className="px-2.5 py-1 bg-brand-bg text-brand-text-secondary font-body text-xs rounded-lg"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <div className="flex items-center gap-1 text-brand-text-secondary">
                    <Clock size={12} />
                    <span className="font-body text-xs">{order.time}</span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-body text-[10px] font-semibold uppercase tracking-wider ${config.bg} ${config.text}`}
                  >
                    <StatusIcon size={10} />
                    {config.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
