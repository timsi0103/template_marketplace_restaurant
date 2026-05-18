import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  User, Mail, Phone, Star, Award, ShoppingBag, MapPin, Edit3, LogOut, Bell, Heart, Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

const API = "/api";

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [ordersCount, setOrdersCount] = useState(0);
  const [recentOrder, setRecentOrder] = useState(null);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user === false)) navigate("/login?redirect=/profile", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user?.email || user?.guest) return;
    setPhone(user.phone || "");
    axios.get(`${API}/orders`, { withCredentials: true }).then(({ data }) => {
      const list = data.orders || [];
      setOrdersCount(list.length);
      setRecentOrder(list[0] || null);
    }).catch(() => {});
  }, [user]);

  if (loading || !user || user === false) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initials = (user.name || user.email || "U").charAt(0).toUpperCase();

  const save = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API}/auth/me`, { phone }, { withCredentials: true });
      toast.success("Profile updated");
      setEditing(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="profile-page" className="min-h-screen bg-brand-bg py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Identity card */}
        <section data-testid="profile-identity" className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6">
          <div className="flex items-start gap-4">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="w-16 h-16 rounded-full object-cover border-2 border-brand-border flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-brand-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white text-2xl font-body font-semibold">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-brand-text tracking-tight">{user.name || user.email}</h1>
              <p className="font-body text-sm text-brand-text-secondary mt-0.5 flex items-center gap-1.5"><Mail size={12} /> {user.email}</p>
              {user.phone && !editing && (
                <p className="font-body text-sm text-brand-text-secondary mt-0.5 flex items-center gap-1.5"><Phone size={12} /> {user.phone}</p>
              )}
              {user.role === "admin" && (
                <Link to="/admin" data-testid="profile-admin-link" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline">
                  <Sparkles size={11} /> Open admin dashboard
                </Link>
              )}
            </div>
            <button
              data-testid="profile-edit-toggle"
              onClick={() => setEditing(!editing)}
              className="text-brand-text-secondary hover:text-brand-primary p-2"
              aria-label="Edit profile"
            >
              <Edit3 size={16} />
            </button>
          </div>

          {editing && (
            <div className="mt-4 pt-4 border-t border-brand-border space-y-3">
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Phone</Label>
                <Input data-testid="profile-phone-input" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-brand-bg border-brand-border h-10" placeholder="+1 555 1234 567" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditing(false)} className="px-4 py-2 text-xs font-semibold text-brand-text-secondary">Cancel</button>
                <button data-testid="profile-save-btn" disabled={saving} onClick={save} className="px-5 py-2 rounded-full bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover disabled:opacity-50">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <Stat icon={ShoppingBag} label="Orders placed" value={ordersCount} testid="profile-stat-orders" />
          <Stat icon={Star} label="Loyalty points" value="2,450" testid="profile-stat-points" />
          <Stat icon={Award} label="Tier" value="Silver" testid="profile-stat-tier" />
        </div>

        {/* Recent order */}
        {recentOrder && (
          <section data-testid="profile-recent-order" className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6">
            <h2 className="font-heading text-base font-bold text-brand-text mb-3">Most recent order</h2>
            <Link to={`/orders/track/${recentOrder.id}`} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-brand-bg border border-brand-border hover:border-brand-primary/40 transition-colors">
              <div className="min-w-0">
                <div className="font-mono text-xs text-brand-text-secondary">{recentOrder.order_number}</div>
                <div className="font-heading text-sm font-bold text-brand-text capitalize">{recentOrder.fulfillment_type} · ${Number(recentOrder.total).toFixed(2)}</div>
              </div>
              <span className="text-xs font-semibold text-brand-primary">Track order →</span>
            </Link>
            <Link to="/orders" data-testid="profile-all-orders-link" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline">
              See all orders <ShoppingBag size={11} />
            </Link>
          </section>
        )}

        {/* Settings */}
        <section data-testid="profile-settings" className="bg-brand-surface border border-brand-border rounded-2xl divide-y divide-brand-border overflow-hidden">
          <ProfileRow icon={Bell} title="Notifications" subtitle="Order updates, deals, and seasonal menus." testid="profile-row-notifications" />
          <ProfileRow icon={Heart} title="Dietary preferences" subtitle="Default filters when you browse the menu." testid="profile-row-dietary" />
          <ProfileRow icon={MapPin} title="Saved addresses" subtitle="For faster delivery checkout." testid="profile-row-addresses" />
          <Link to="/loyalty" data-testid="profile-row-loyalty" className="flex items-start gap-3 p-4 hover:bg-brand-bg transition-colors">
            <span className="w-9 h-9 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
              <Star size={16} />
            </span>
            <div className="flex-1">
              <div className="font-heading text-sm font-bold text-brand-text">Loyalty & rewards</div>
              <div className="text-xs text-brand-text-secondary mt-0.5">View your points, perks, and tier progress.</div>
            </div>
          </Link>
        </section>

        <button
          data-testid="profile-logout-btn"
          onClick={logout}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-brand-surface border border-brand-border text-red-600 font-body text-sm font-semibold hover:bg-red-50 transition-colors"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, testid }) {
  return (
    <div data-testid={testid} className="bg-brand-surface border border-brand-border rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-brand-text-secondary font-semibold mb-1.5">
        <Icon size={11} /> {label}
      </div>
      <div className="font-heading text-2xl font-bold text-brand-text">{value}</div>
    </div>
  );
}

function ProfileRow({ icon: Icon, title, subtitle, testid }) {
  return (
    <div data-testid={testid} className="flex items-start gap-3 p-4 hover:bg-brand-bg/50 transition-colors cursor-pointer" onClick={() => toast("Coming soon")}>
      <span className="w-9 h-9 rounded-full bg-brand-bg border border-brand-border text-brand-text-secondary flex items-center justify-center flex-shrink-0">
        <Icon size={16} />
      </span>
      <div className="flex-1">
        <div className="font-heading text-sm font-bold text-brand-text">{title}</div>
        <div className="text-xs text-brand-text-secondary mt-0.5">{subtitle}</div>
      </div>
    </div>
  );
}
