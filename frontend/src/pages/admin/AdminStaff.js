import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Plus, UserPlus, Mail, Copy, Trash2, MoreHorizontal, Shield, Clock, CheckCircle2, Ban, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API = "/api";

export default function AdminStaff() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [roles, setRoles] = useState([]);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        axios.get(`${API}/admin/staff`, { withCredentials: true }),
        axios.get(`${API}/admin/roles`, { withCredentials: true }),
      ]);
      setData(s.data); setRoles(r.data.roles);
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) return <div data-testid="staff-loading" className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-brand-primary" /></div>;

  return (
    <div data-testid="admin-staff-page" className="p-6 lg:p-10 max-w-6xl">
      <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 data-testid="staff-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">Staff Accounts</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">Invite, manage, and deactivate every team member who logs in to the back office.</p>
        </div>
        <div className="flex gap-2">
          <button data-testid="staff-refresh-btn" onClick={load} className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text-secondary font-body text-sm font-medium rounded-full hover:bg-brand-surface"><RefreshCw size={14} /></button>
          <button data-testid="staff-invite-btn" onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover">
            <UserPlus size={14} /> Invite staff
          </button>
        </div>
      </header>

      {/* Pending invites */}
      {data.invites.length > 0 && (
        <section data-testid="staff-invites-section" className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
          <header className="px-5 py-3 border-b border-amber-200 flex items-center gap-2">
            <Mail size={16} className="text-amber-700" />
            <span className="font-body text-sm font-bold text-amber-900">Pending invitations · {data.invites.length}</span>
          </header>
          <ul>
            {data.invites.map((i) => <InviteRow key={i.id} invite={i} onChange={load} />)}
          </ul>
        </section>
      )}

      {/* Staff table */}
      <section className="bg-brand-surface border border-brand-border rounded-2xl overflow-hidden">
        {data.staff.length === 0 ? (
          <div data-testid="staff-empty" className="p-10 text-center">
            <UserPlus size={28} className="mx-auto text-brand-text-secondary mb-2" />
            <p className="font-body text-sm text-brand-text-secondary">No staff yet. Invite your first team member to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6"><table className="w-full text-sm font-body min-w-[640px]">
            <thead className="bg-brand-bg">
              <tr>
                <th className="p-3 text-left text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Name</th>
                <th className="p-3 text-left text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Email</th>
                <th className="p-3 text-left text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Role</th>
                <th className="p-3 text-left text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Last active</th>
                <th className="p-3 text-left text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Status</th>
                <th className="p-3 text-right text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {data.staff.map((u) => <StaffRow key={u.user_id} user={u} roles={roles} onChange={load} />)}
            </tbody>
          </table></div>
        )}
      </section>

      <div className="mt-5 flex gap-2">
        <Link to="/admin/roles" data-testid="staff-manage-roles-link" className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text-secondary font-body text-sm font-medium rounded-full hover:bg-brand-surface">
          <Shield size={14} /> Manage roles
        </Link>
      </div>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} roles={roles} onInvited={load} />
    </div>
  );
}

function InviteRow({ invite, onChange }) {
  const copyLink = () => {
    try {
      navigator.clipboard.writeText(invite.accept_url);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy — select the link manually");
    }
  };
  const revoke = async () => {
    if (!window.confirm("Revoke this invite? The link will stop working.")) return;
    try {
      await axios.post(`${API}/admin/staff/invites/${invite.id}/revoke`, {}, { withCredentials: true });
      toast.success("Invite revoked");
      onChange?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Revoke failed"); }
  };
  return (
    <li data-testid={`invite-row-${invite.id}`} className="px-5 py-3 flex items-center gap-3 border-b border-amber-200 last:border-0">
      <Mail size={14} className="text-amber-700 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-body text-sm font-semibold text-amber-900 truncate">{invite.email}</div>
        <div className="text-[11px] text-amber-800">Invited as {invite.role_name} · expires {new Date(invite.expires_at).toLocaleDateString()} · <span className="uppercase tracking-wider font-bold">MOCKED email</span></div>
      </div>
      <button data-testid={`invite-copy-${invite.id}`} onClick={copyLink} className="inline-flex items-center gap-1 px-3 py-1.5 border border-amber-300 text-amber-800 text-xs font-semibold rounded-full hover:bg-amber-100"><Copy size={12} /> Copy link</button>
      <button data-testid={`invite-revoke-${invite.id}`} onClick={revoke} className="text-amber-700 hover:text-red-600 p-1"><Trash2 size={14} /></button>
    </li>
  );
}

function StaffRow({ user, roles, onChange }) {
  const [editing, setEditing] = useState(false);
  const [roleId, setRoleId] = useState(user.role_id || "");

  const saveRole = async () => {
    try {
      await axios.patch(`${API}/admin/staff/${user.user_id}`, { role_id: roleId }, { withCredentials: true });
      toast.success("Role updated");
      setEditing(false);
      onChange?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };
  const deactivate = async () => {
    if (!window.confirm(`Deactivate ${user.email}?`)) return;
    try {
      await axios.post(`${API}/admin/staff/${user.user_id}/deactivate`, {}, { withCredentials: true });
      toast.success("Account deactivated");
      onChange?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };
  const reactivate = async () => {
    try {
      await axios.post(`${API}/admin/staff/${user.user_id}/reactivate`, {}, { withCredentials: true });
      toast.success("Account reactivated");
      onChange?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <tr data-testid={`staff-row-${user.user_id}`} className="border-t border-brand-border">
      <td className="p-3 font-semibold text-brand-text">{user.name || "—"}</td>
      <td className="p-3 text-brand-text-secondary">{user.email}</td>
      <td className="p-3">
        {editing ? (
          <div className="flex items-center gap-1">
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <button onClick={saveRole} className="text-xs font-semibold text-brand-primary px-2">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-brand-text-secondary px-1">Cancel</button>
          </div>
        ) : (
          <button
            data-testid={`staff-role-btn-${user.user_id}`}
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-body font-bold bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20"
          >
            {user.role_name || user.role}
          </button>
        )}
      </td>
      <td className="p-3 text-xs text-brand-text-secondary">{user.last_active_at ? new Date(user.last_active_at).toLocaleString() : "—"}</td>
      <td className="p-3">
        {user.is_active === false ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold"><Ban size={10} /> Inactive</span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold"><CheckCircle2 size={10} /> Active</span>
        )}
      </td>
      <td className="p-3 text-right">
        <Link data-testid={`staff-profile-link-${user.user_id}`} to={`/admin/staff/${user.user_id}`} className="text-xs text-brand-primary hover:underline mr-3">View</Link>
        {user.is_active === false ? (
          <button data-testid={`staff-reactivate-${user.user_id}`} onClick={reactivate} className="text-xs text-emerald-700 hover:underline">Reactivate</button>
        ) : (
          <button data-testid={`staff-deactivate-${user.user_id}`} onClick={deactivate} className="text-xs text-red-600 hover:underline">Deactivate</button>
        )}
      </td>
    </tr>
  );
}

function InviteDialog({ open, onClose, roles, onInvited }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState(roles.find((r) => r.slug === "manager")?.id || roles[0]?.id || "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);

  useEffect(() => { if (!open) { setTimeout(() => { setEmail(""); setName(""); setSent(null); setRoleId(roles.find((r) => r.slug === "manager")?.id || roles[0]?.id || ""); }, 250); } }, [open, roles]);

  const submit = async () => {
    if (!email || !roleId) return toast.error("Email and role required");
    setSending(true);
    try {
      const { data } = await axios.post(`${API}/admin/staff/invite`, { email, name, role_id: roleId }, { withCredentials: true });
      setSent(data);
      onInvited?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Invite failed");
    } finally { setSending(false); }
  };

  const copy = () => {
    try {
      navigator.clipboard.writeText(sent.accept_url);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy — select the link manually");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-testid="invite-dialog">
        {!sent ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading">Invite a staff member</DialogTitle>
              <DialogDescription className="font-body">They'll get an invitation link to set their password and join your team. <span className="uppercase tracking-wider text-brand-primary font-bold">MOCKED email</span> — link is returned instantly for copying.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-3">
              <div>
                <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Email</Label>
                <Input data-testid="invite-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="new.hire@example.com" className="mt-1.5" />
              </div>
              <div>
                <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Name (optional)</Label>
                <Input data-testid="invite-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="mt-1.5" />
              </div>
              <div>
                <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Role</Label>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger data-testid="invite-role-select" className="mt-1.5"><SelectValue placeholder="Choose a role" /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 border border-brand-border text-brand-text-secondary font-body text-sm rounded-full hover:bg-brand-surface">Cancel</button>
              <button data-testid="invite-send-btn" onClick={submit} disabled={sending} className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Send invitation
              </button>
            </div>
          </>
        ) : (
          <div data-testid="invite-sent-state" className="text-center py-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border-2 border-emerald-200 inline-flex items-center justify-center mb-3">
              <CheckCircle2 size={24} className="text-emerald-600" />
            </div>
            <h3 className="font-heading text-lg font-bold text-brand-text">Invitation created</h3>
            <p className="font-body text-xs text-brand-text-secondary mt-1 mb-3">
              {sent.email} has been invited as {sent.role_name}. Copy the link below and share it manually — we don't send real emails yet.
            </p>
            <div className="p-2 bg-brand-bg border border-brand-border rounded-lg flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono truncate text-brand-text text-left">{sent.accept_url}</code>
              <button data-testid="invite-copy-link-btn" onClick={copy} className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-primary text-white text-xs font-semibold rounded-full hover:bg-brand-primary-hover"><Copy size={12} /> Copy</button>
            </div>
            <button onClick={onClose} data-testid="invite-done-btn" className="mt-4 px-5 py-2 border border-brand-border text-brand-text-secondary font-body text-sm rounded-full hover:bg-brand-surface">Done</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
