import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, ChevronLeft, Shield, Mail, Phone, Activity, Ban, CheckCircle2, Calendar } from "lucide-react";

const API = "/api";

export default function AdminStaffProfile() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (userId) load(); }, [userId]);
  async function load() {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([
        axios.get(`${API}/admin/staff/${userId}`, { withCredentials: true }),
        axios.get(`${API}/admin/staff/${userId}/activity`, { withCredentials: true }),
      ]);
      setUser(u.data); setActivity(a.data.entries);
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    finally { setLoading(false); }
  }

  if (loading || !user) return <div data-testid="staff-profile-loading" className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-brand-primary" /></div>;
  const role = user.role || {};
  const perms = role.permissions || {};

  return (
    <div data-testid="admin-staff-profile-page" className="p-6 lg:p-10 max-w-5xl">
      <Link to="/admin/staff" className="inline-flex items-center gap-1 text-sm text-brand-text-secondary hover:text-brand-primary mb-4"><ChevronLeft size={14} /> Back to staff</Link>
      <header className="flex items-start gap-5 mb-8">
        <div className="w-20 h-20 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary font-heading font-bold text-2xl">
          {(user.name || user.email).slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 data-testid="staff-profile-name" className="font-heading text-3xl font-bold text-brand-text">{user.name || user.email}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-body font-bold bg-brand-primary/10 text-brand-primary"><Shield size={11} /> {role.name || user.role}</span>
            {user.is_active === false
              ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700"><Ban size={10} /> Inactive</span>
              : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700"><CheckCircle2 size={10} /> Active</span>}
          </div>
          <div className="mt-3 text-sm font-body text-brand-text-secondary space-y-1">
            <div className="flex items-center gap-1.5"><Mail size={12} /> {user.email}</div>
            {user.phone && <div className="flex items-center gap-1.5"><Phone size={12} /> {user.phone}</div>}
            {user.created_at && <div className="flex items-center gap-1.5"><Calendar size={12} /> Joined {new Date(user.created_at).toLocaleDateString()}</div>}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity summary */}
        <section data-testid="staff-activity-summary" className="bg-brand-surface border border-brand-border rounded-2xl p-5">
          <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2 mb-4"><Activity size={16} className="text-brand-primary" /> Activity summary</h2>
          <div className="space-y-3">
            <SummaryRow label="Order actions" value={user.activity_summary?.orders_actions || 0} />
            <SummaryRow label="86'd menu items" value={user.activity_summary?.eightysix_actions || 0} />
            <SummaryRow label="Last active" value={user.last_active_at ? new Date(user.last_active_at).toLocaleString() : "—"} />
          </div>
        </section>

        {/* Permission overview */}
        <section data-testid="staff-permissions" className="bg-brand-surface border border-brand-border rounded-2xl p-5 lg:col-span-2">
          <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2 mb-4"><Shield size={16} className="text-brand-primary" /> Permissions from {role.name || user.role}</h2>
          {role.description && <p className="font-body text-xs text-brand-text-secondary mb-4">{role.description}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(perms).map(([area, actions]) => {
              const any = Object.values(actions).some(Boolean);
              return (
                <div key={area} data-testid={`staff-perm-${area}`} className={`p-3 border rounded-lg text-sm ${any ? "border-brand-border bg-white" : "border-dashed border-brand-border bg-brand-bg"}`}>
                  <div className="font-body font-semibold capitalize text-brand-text">{area.replace(/_/g, " ")}</div>
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {Object.entries(actions).map(([act, allowed]) => (
                      <span key={act} className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-semibold ${allowed ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400 line-through"}`}>{act}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Activity log */}
      <section className="mt-6 bg-brand-surface border border-brand-border rounded-2xl overflow-hidden">
        <header className="px-5 py-3 border-b border-brand-border">
          <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2"><Activity size={16} className="text-brand-primary" /> Activity log · {activity.length}</h2>
        </header>
        {activity.length === 0 ? (
          <div data-testid="staff-activity-empty" className="p-10 text-center text-sm font-body text-brand-text-secondary italic">No recorded activity yet.</div>
        ) : (
          <ul data-testid="staff-activity-list">
            {activity.map((e, i) => (
              <li key={`${e.action || "act"}-${e.created_at || e.at || ""}-${i}`} data-testid={`staff-activity-row-${i}`} className="px-5 py-3 border-b border-brand-border last:border-0 flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-2.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-body text-sm text-brand-text">
                    <span className="font-semibold capitalize">{(e.action || "").replace(/_/g, " ")}</span>
                    {e.subject && <span className="text-brand-text-secondary"> · {e.subject}</span>}
                  </div>
                  <div className="text-[11px] text-brand-text-secondary uppercase tracking-wider mt-0.5">{e.area}</div>
                </div>
                <span className="text-[11px] text-brand-text-secondary whitespace-nowrap">{e.when ? new Date(e.when).toLocaleString() : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-body text-xs text-brand-text-secondary">{label}</span>
      <span className="font-body text-sm font-semibold text-brand-text">{value}</span>
    </div>
  );
}
