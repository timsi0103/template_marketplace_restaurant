import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Ticket, Percent, DollarSign, Truck, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API = "/api";

const TYPE_META = {
  percent: { label: "Percentage", icon: Percent, color: "text-brand-primary" },
  fixed: { label: "Fixed amount", icon: DollarSign, color: "text-brand-orange" },
  free_delivery: { label: "Free delivery", icon: Truck, color: "text-green-600" },
};

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/coupons`, { withCredentials: true });
      setCoupons(data.coupons || []);
    } catch (e) {
      toast.error("Could not load coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (c) => {
    try {
      const { data } = await axios.patch(`${API}/admin/coupons/${c.id}/toggle`, {}, { withCredentials: true });
      setCoupons((list) => list.map((x) => (x.id === c.id ? data : x)));
      toast.success(data.active ? "Coupon activated" : "Coupon deactivated");
    } catch {
      toast.error("Could not toggle coupon");
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    try {
      await axios.delete(`${API}/admin/coupons/${c.id}`, { withCredentials: true });
      setCoupons((list) => list.filter((x) => x.id !== c.id));
      toast.success(`${c.code} deleted`);
    } catch {
      toast.error("Could not delete coupon");
    }
  };

  const isExpired = (c) => {
    if (!c.expires_at) return false;
    try { return new Date(c.expires_at) < new Date(new Date().toDateString()); } catch { return false; }
  };

  if (loading) return <div data-testid="coupons-loading" className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div data-testid="admin-coupons-page" className="p-6 lg:p-10 max-w-6xl">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 data-testid="coupons-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text tracking-tight mb-1">Coupons</h1>
          <p className="font-body text-sm text-brand-text-secondary">Promotion codes customers can redeem at checkout.</p>
        </div>
        <button
          data-testid="new-coupon-btn"
          onClick={() => navigate("/admin/coupons/new")}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover transition"
        >
          <Plus size={14} /> New coupon
        </button>
      </div>

      {coupons.length === 0 ? (
        <div data-testid="coupons-empty" className="bg-brand-surface border border-brand-border rounded-2xl p-10 text-center">
          <Ticket size={36} className="mx-auto text-brand-border mb-3" />
          <h3 className="font-heading text-lg font-bold text-brand-text">No coupons yet</h3>
          <p className="font-body text-sm text-brand-text-secondary mb-4">Create your first coupon to start offering promotions.</p>
          <Link to="/admin/coupons/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full">
            <Plus size={14} /> Create coupon
          </Link>
        </div>
      ) : (
        <div data-testid="coupons-table" className="bg-brand-surface border border-brand-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="overflow-x-auto -mx-6 px-6"><table className="w-full min-w-[640px]">
              <thead className="bg-brand-bg text-left">
                <tr>
                  <Th>Code</Th>
                  <Th>Type</Th>
                  <Th>Value</Th>
                  <Th>Min order</Th>
                  <Th>Usage</Th>
                  <Th>Expires</Th>
                  <Th>Active</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => {
                  const meta = TYPE_META[c.type] || TYPE_META.percent;
                  const Icon = meta.icon;
                  const expired = isExpired(c);
                  return (
                    <tr key={c.id} data-testid={`coupon-row-${c.code}`} className="border-t border-brand-border hover:bg-brand-bg/50 transition">
                      <td className="px-4 py-3">
                        <div className="font-mono tracking-wider text-sm font-semibold text-brand-text">{c.code}</div>
                        {c.description && <div className="font-body text-[11px] text-brand-text-secondary mt-0.5 max-w-xs truncate">{c.description}</div>}
                        {c.first_order_only && <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary font-semibold">First-order only</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-body">
                          <Icon size={12} className={meta.color} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-body text-sm text-brand-text">
                        {c.type === "percent" && `${c.value}%`}
                        {c.type === "fixed" && `$${c.value.toFixed(2)}`}
                        {c.type === "free_delivery" && "—"}
                      </td>
                      <td className="px-4 py-3 font-body text-sm text-brand-text-secondary">
                        {c.min_subtotal > 0 ? `$${c.min_subtotal.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 font-body text-sm">
                        <span data-testid={`coupon-usage-${c.code}`} className="text-brand-text">
                          {c.usage_count}{c.usage_limit != null ? `/${c.usage_limit}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-body text-sm">
                        {c.expires_at ? (
                          <span className={`inline-flex items-center gap-1 ${expired ? "text-red-600" : "text-brand-text-secondary"}`}>
                            {expired && <AlertCircle size={11} />}
                            {c.expires_at}
                          </span>
                        ) : (
                          <span className="text-brand-text-secondary">No expiry</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          data-testid={`coupon-toggle-${c.code}`}
                          onClick={() => toggleActive(c)}
                          aria-label={c.active ? "Deactivate" : "Activate"}
                          className={`relative w-10 h-5 rounded-full transition-colors ${c.active ? "bg-brand-primary" : "bg-brand-border"}`}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${c.active ? "translate-x-5" : "translate-x-0.5"}`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            to={`/admin/coupons/${c.id}/edit`}
                            data-testid={`coupon-edit-${c.code}`}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-text-secondary hover:text-brand-primary hover:bg-brand-primary/5 transition"
                          >
                            <Pencil size={14} />
                          </Link>
                          <button
                            data-testid={`coupon-delete-${c.code}`}
                            onClick={() => remove(c)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-text-secondary hover:text-red-500 hover:bg-red-50 transition"
                          >
                            <Trash2 size={14} />
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
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-4 py-3 font-body text-[10px] uppercase tracking-widest font-semibold text-brand-text-secondary ${className}`}>{children}</th>;
}
