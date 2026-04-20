import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Plus, Shield, Trash2, Save, Check, Edit3, X, RefreshCw, Grid3x3, ListChecks } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const API = "/api";

export default function AdminRoles() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null); // {roles, feature_areas, actions}
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null); // role id

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/roles`, { withCredentials: true });
      setData(data);
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    finally { setLoading(false); }
  }

  if (loading || !data) return <div data-testid="roles-loading" className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-brand-primary" /></div>;

  return (
    <div data-testid="admin-roles-page" className="p-6 lg:p-10 max-w-[1300px]">
      <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 data-testid="roles-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">Roles &amp; Permissions</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">Pre-defined roles cover the common cases. Build custom roles when you need finer control.</p>
        </div>
        <div className="flex gap-2">
          <button data-testid="roles-refresh-btn" onClick={load} className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text-secondary font-body text-sm font-medium rounded-full hover:bg-brand-surface"><RefreshCw size={14} /></button>
          <button data-testid="roles-new-btn" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover">
            <Plus size={14} /> New custom role
          </button>
        </div>
      </header>

      <Tabs defaultValue="cards">
        <TabsList className="bg-brand-surface border border-brand-border rounded-full p-1 inline-flex">
          <TabsTrigger data-testid="roles-tab-cards" value="cards" className="rounded-full px-4 text-sm"><ListChecks size={14} className="mr-1.5" /> Role cards</TabsTrigger>
          <TabsTrigger data-testid="roles-tab-matrix" value="matrix" className="rounded-full px-4 text-sm"><Grid3x3 size={14} className="mr-1.5" /> Permission matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.roles.map((r) => (
              <RoleCard key={r.id} role={r} featureAreas={data.feature_areas} actions={data.actions}
                onEdit={() => setEditing(r.id)} onDeleted={load} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="matrix" className="mt-6">
          <PermissionMatrix data={data} onEditCustom={(id) => setEditing(id)} />
        </TabsContent>
      </Tabs>

      <CreateOrEditRoleDialog
        open={createOpen || !!editing}
        role={editing ? data.roles.find((r) => r.id === editing) : null}
        featureAreas={data.feature_areas}
        actions={data.actions}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onSaved={() => { setCreateOpen(false); setEditing(null); load(); }}
      />
    </div>
  );
}

function RoleCard({ role, featureAreas, actions, onEdit, onDeleted }) {
  const allowedCount = featureAreas.reduce((s, a) => s + (role.permissions[a.key] && Object.values(role.permissions[a.key]).some(Boolean) ? 1 : 0), 0);
  const remove = async () => {
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    try {
      await axios.delete(`${API}/admin/roles/${role.id}`, { withCredentials: true });
      toast.success("Role deleted");
      onDeleted?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Delete failed"); }
  };
  return (
    <div data-testid={`role-card-${role.slug}`} className="bg-brand-surface border border-brand-border rounded-2xl p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-xl ${role.pre_defined ? "bg-brand-primary/10" : "bg-purple-100"} flex items-center justify-center`}>
            <Shield size={18} className={role.pre_defined ? "text-brand-primary" : "text-purple-700"} />
          </div>
          <div>
            <div className="font-heading text-base font-bold text-brand-text">{role.name}</div>
            <div className="text-[11px] uppercase tracking-wider text-brand-text-secondary font-body font-semibold">{role.pre_defined ? "Pre-defined" : "Custom"}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-brand-text-secondary">{role.staff_count || 0} staff</div>
        </div>
      </div>
      <p className="font-body text-xs text-brand-text-secondary mb-4 min-h-[2.5rem]">{role.description || "—"}</p>

      {/* Permission chips */}
      <div className="flex flex-wrap gap-1 mb-4">
        {featureAreas.map((a) => {
          const any = role.permissions[a.key] && Object.values(role.permissions[a.key]).some(Boolean);
          return (
            <span
              key={a.key}
              data-testid={`role-${role.slug}-perm-${a.key}`}
              className={`text-[10px] px-2 py-0.5 rounded-full font-body font-semibold ${any ? "bg-brand-primary/10 text-brand-primary" : "bg-brand-bg text-brand-text-secondary line-through"}`}
            >
              {a.label}
            </span>
          );
        })}
      </div>

      <div className="mt-auto flex justify-between pt-3 border-t border-brand-border">
        <span className="font-body text-[11px] text-brand-text-secondary">{allowedCount}/{featureAreas.length} areas</span>
        <div className="flex gap-2">
          {!role.pre_defined && <button data-testid={`role-delete-${role.slug}`} onClick={remove} className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"><Trash2 size={12} /> Delete</button>}
          {role.pre_defined ? (
            <span className="text-[11px] text-brand-text-secondary italic">Read-only</span>
          ) : (
            <button data-testid={`role-edit-${role.slug}`} onClick={onEdit} className="text-xs text-brand-primary hover:underline inline-flex items-center gap-1"><Edit3 size={12} /> Edit</button>
          )}
        </div>
      </div>
    </div>
  );
}

function PermissionMatrix({ data, onEditCustom }) {
  return (
    <div data-testid="permission-matrix" className="bg-brand-surface border border-brand-border rounded-2xl overflow-auto">
      <div className="overflow-x-auto -mx-6 px-6"><table className="w-full text-sm font-body min-w-[640px]">
        <thead className="bg-brand-bg sticky top-0">
          <tr>
            <th className="p-3 text-left text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold sticky left-0 bg-brand-bg">Role</th>
            {data.feature_areas.map((a) => (
              <th key={a.key} className="p-3 text-left text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold whitespace-nowrap" colSpan={data.actions.length}>
                {a.label}
              </th>
            ))}
          </tr>
          <tr>
            <th className="px-3 pb-2 sticky left-0 bg-brand-bg"></th>
            {data.feature_areas.map((a) => (
              data.actions.map((act) => (
                <th key={`${a.key}-${act}`} className="px-2 pb-2 text-[10px] text-brand-text-secondary font-body font-medium uppercase">{act}</th>
              ))
            ))}
          </tr>
        </thead>
        <tbody>
          {data.roles.map((r) => (
            <tr key={r.id} data-testid={`matrix-row-${r.slug}`} className="border-t border-brand-border">
              <td className="p-3 sticky left-0 bg-brand-surface">
                <div className="font-semibold text-brand-text">{r.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-brand-text-secondary">{r.pre_defined ? "Pre-defined" : "Custom"}</div>
                {!r.pre_defined && (
                  <button onClick={() => onEditCustom(r.id)} data-testid={`matrix-edit-${r.slug}`} className="text-[10px] text-brand-primary hover:underline mt-1">Edit</button>
                )}
              </td>
              {data.feature_areas.map((a) => (
                data.actions.map((act) => {
                  const allowed = r.permissions?.[a.key]?.[act];
                  return (
                    <td key={`${r.id}-${a.key}-${act}`} className="px-2 py-3 text-center">
                      {allowed ? <Check size={14} className="text-emerald-600 inline" /> : <span className="text-brand-text-secondary/40">—</span>}
                    </td>
                  );
                })
              ))}
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

function CreateOrEditRoleDialog({ open, role, featureAreas, actions, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [perms, setPerms] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (role) {
      setName(role.name);
      setDescription(role.description || "");
      setPerms(JSON.parse(JSON.stringify(role.permissions || {})));
    } else {
      setName("");
      setDescription("");
      const empty = {};
      featureAreas.forEach((a) => { empty[a.key] = {}; actions.forEach((act) => empty[a.key][act] = false); });
      setPerms(empty);
    }
  }, [open, role, featureAreas, actions]);

  const toggle = (areaKey, act) => {
    setPerms((p) => ({ ...p, [areaKey]: { ...(p[areaKey] || {}), [act]: !p[areaKey]?.[act] } }));
  };
  const toggleArea = (areaKey, on) => {
    setPerms((p) => ({ ...p, [areaKey]: actions.reduce((acc, a) => ({ ...acc, [a]: on }), {}) }));
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    setSaving(true);
    try {
      if (role) {
        await axios.patch(`${API}/admin/roles/${role.id}`, { name, description, permissions: perms }, { withCredentials: true });
        toast.success("Role updated");
      } else {
        await axios.post(`${API}/admin/roles`, { name, description, permissions: perms }, { withCredentials: true });
        toast.success("Role created");
      }
      onSaved?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-testid="role-dialog" className="sm:max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{role ? `Edit ${role.name}` : "New custom role"}</DialogTitle>
          <DialogDescription className="font-body">Toggle what this role can view, edit, or approve.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-3">
          <div>
            <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Role name</Label>
            <Input data-testid="role-name-input" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Description</Label>
            <Textarea data-testid="role-desc-input" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5 min-h-[60px]" />
          </div>
          <div>
            <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Permissions</Label>
            <div className="mt-2 space-y-2">
              {featureAreas.map((a) => {
                const areaPerms = perms[a.key] || {};
                const allOn = actions.every((act) => areaPerms[act]);
                return (
                  <div key={a.key} data-testid={`role-perm-area-${a.key}`} className="p-3 border border-brand-border rounded-lg bg-brand-bg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-body font-semibold text-sm text-brand-text">{a.label}</div>
                      </div>
                      <Switch data-testid={`role-perm-area-switch-${a.key}`} checked={allOn} onCheckedChange={(v) => toggleArea(a.key, v)} />
                    </div>
                    <div className="mt-2 flex gap-2">
                      {actions.map((act) => (
                        <button
                          key={act}
                          data-testid={`role-perm-${a.key}-${act}`}
                          onClick={() => toggle(a.key, act)}
                          className={`px-3 py-1 rounded-full text-xs font-body font-semibold uppercase tracking-wider border transition ${areaPerms[act] ? "bg-brand-primary text-white border-brand-primary" : "border-brand-border text-brand-text-secondary"}`}
                        >
                          {act}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-brand-border text-brand-text-secondary font-body text-sm rounded-full hover:bg-brand-surface">Cancel</button>
          <button data-testid="role-save-btn" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {role ? "Save changes" : "Create role"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
