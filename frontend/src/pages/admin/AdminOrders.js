import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, RefreshCw, Printer, Receipt as ReceiptIcon, Truck, Store, Utensils, Eye, Search as SearchIcon, X, Pencil } from "lucide-react";
import AdminModifyOrderDrawer from "@/components/admin/AdminModifyOrderDrawer";

const API = "/api";

const FULFILL_ICON = { delivery: Truck, pickup: Store, dine_in: Utensils };
const STATUS_META = {
  pending: { label: "Incoming", cls: "bg-amber-100 text-amber-800" },
  preparing: { label: "Preparing", cls: "bg-blue-100 text-blue-800" },
  ready: { label: "Ready", cls: "bg-green-100 text-green-800" },
  out_for_delivery: { label: "Out for delivery", cls: "bg-indigo-100 text-indigo-800" },
  delivered: { label: "Delivered", cls: "bg-gray-100 text-gray-800" },
  completed: { label: "Completed", cls: "bg-gray-100 text-gray-800" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-800" },
};

function fmt(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

export default function AdminOrders() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("active"); // active | all
  const [q, setQ] = useState("");
  const [manageId, setManageId] = useState(null);

  const load = async (opts = {}) => {
    if (opts.manual) setRefreshing(true);
    try {
      if (q.trim()) {
        const { data } = await axios.get(`${API}/admin/search/orders`, { params: { q: q.trim() }, withCredentials: true });
        setOrders(data.orders || []);
      } else {
        const path = filter === "active" ? `${API}/admin/queue` : `${API}/orders?all=1`;
        const { data } = await axios.get(path, { withCredentials: true });
        setOrders(data.queue || data.orders || []);
      }
      if (opts.manual) toast.success("Orders refreshed");
    } catch { toast.error("Could not load orders"); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { setLoading(true); load(); /* eslint-disable-next-line */ }, [filter]);
  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => { setLoading(true); load(); }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line
  }, [q]);

  return (
    <div data-testid="admin-orders-page" className="p-6 sm:p-10 max-w-6xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-brand-text">Orders</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">Manage incoming and active orders. Reprint any ticket in one click.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
            <input
              data-testid="admin-orders-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search order #, name, email…"
              className="pl-8 pr-8 h-9 w-56 rounded-full border border-brand-border bg-brand-surface focus:bg-white focus:border-brand-primary/60 text-sm outline-none"
            />
            {q && (
              <button onClick={() => setQ("")} data-testid="admin-orders-search-clear" className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-secondary hover:text-brand-primary">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="inline-flex rounded-full border border-brand-border p-1 bg-brand-surface">
            {["active", "all"].map((k) => (
              <button
                key={k}
                data-testid={`orders-filter-${k}`}
                onClick={() => setFilter(k)}
                disabled={!!q.trim()}
                className={`px-3 py-1 text-xs font-semibold rounded-full capitalize transition ${filter === k ? "bg-brand-primary text-white" : "text-brand-text-secondary"} ${q.trim() ? "opacity-40 pointer-events-none" : ""}`}
              >{k}</button>
            ))}
          </div>
          <button onClick={() => load({ manual: true })} disabled={refreshing} data-testid="refresh-orders-btn" title="Refresh orders" className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-brand-border text-brand-text-secondary hover:text-brand-primary hover:border-brand-primary/40 transition disabled:opacity-50">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 size={28} className="animate-spin text-brand-primary" /></div>
      ) : orders.length === 0 ? (
        <div data-testid="no-admin-orders" className="bg-brand-surface border border-dashed border-brand-border rounded-xl p-10 text-center">
          <p className="font-body text-sm text-brand-text-secondary">No orders to show.</p>
        </div>
      ) : (
        <div className="bg-white border border-brand-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="overflow-x-auto -mx-6 px-6"><table className="w-full text-sm min-w-[640px]">
              <thead className="bg-brand-surface text-left">
                <tr>
                  <th className="p-3 font-semibold">Order</th>
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold">Customer</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Total</th>
                  <th className="p-3 font-semibold">When</th>
                  <th className="p-3 font-semibold text-right">Reprint</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const Icon = FULFILL_ICON[o.fulfillment_type] || Printer;
                  const sm = STATUS_META[o.status] || { label: o.status, cls: "bg-gray-100" };
                  return (
                    <tr key={o.id} data-testid={`admin-order-row-${o.id}`} className="border-t border-brand-border">
                      <td className="p-3 font-mono text-xs">{o.order_number || o.id.slice(0, 6)}</td>
                      <td className="p-3"><span className="inline-flex items-center gap-1 text-xs"><Icon size={12} /> {o.fulfillment_type}</span></td>
                      <td className="p-3 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{o.contact_name || o.contact_email || "—"}</span>
                          {!o.user_id && (
                            <span data-testid={`admin-guest-badge-${o.id}`} className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-body font-bold uppercase tracking-wider">Guest</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3"><span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${sm.cls}`}>{sm.label}</span></td>
                      <td className="p-3 text-xs">${(o.total || 0).toFixed(2)}</td>
                      <td className="p-3 text-xs whitespace-nowrap">{fmt(o.created_at)}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="inline-flex gap-2">
                          <Link
                            target="_blank" rel="noopener noreferrer"
                            to={`/admin/ticket/${o.id}?type=kitchen&trigger=reprint&auto=1`}
                            data-testid={`reprint-kitchen-${o.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 border border-brand-border rounded-md text-xs font-semibold hover:border-brand-primary/40 hover:text-brand-primary"
                          >
                            <Printer size={12} /> Kitchen
                          </Link>
                          <Link
                            target="_blank" rel="noopener noreferrer"
                            to={`/admin/ticket/${o.id}?type=receipt&trigger=reprint&auto=1`}
                            data-testid={`reprint-receipt-${o.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 border border-brand-border rounded-md text-xs font-semibold hover:border-brand-primary/40 hover:text-brand-primary"
                          >
                            <ReceiptIcon size={12} /> Receipt
                          </Link>
                          <Link
                            to={`/orders/track/${o.id}`}
                            data-testid={`view-order-${o.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 border border-brand-border rounded-md text-xs font-semibold hover:border-brand-primary/40 hover:text-brand-primary"
                          >
                            <Eye size={12} />
                          </Link>
                          <button
                            onClick={() => setManageId(o.id)}
                            data-testid={`manage-order-${o.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 border border-brand-border rounded-md text-xs font-semibold hover:border-brand-primary/40 hover:text-brand-primary"
                          >
                            <Pencil size={12} /> Manage
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
        </div>
      )}
      <AdminModifyOrderDrawer
        open={!!manageId}
        orderId={manageId}
        onClose={() => setManageId(null)}
        onSaved={() => { setManageId(null); load(); }}
      />
    </div>
  );
}
