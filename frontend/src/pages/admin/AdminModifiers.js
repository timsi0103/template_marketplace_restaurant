import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Settings2 } from "lucide-react";
import axios from "axios";

const API_BASE = "/api";

export default function AdminModifiers() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE}/modifiers`, { withCredentials: true })
      .then(({ data }) => setGroups(data.groups || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (groupId) => {
    if (deleting === groupId) {
      try {
        await axios.delete(`${API_BASE}/admin/modifiers/${groupId}`, { withCredentials: true });
        setGroups(prev => prev.filter(g => g.id !== groupId));
      } catch (e) {
        console.error("Delete failed", e);
      }
      setDeleting(null);
    } else {
      setDeleting(groupId);
      setTimeout(() => setDeleting(null), 3000);
    }
  };

  return (
    <div className="p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 data-testid="modifiers-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text tracking-tight">Modifier Groups</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">{groups.length} modifier groups configured</p>
        </div>
        <Link to="/admin/modifiers/new" data-testid="add-modifier-btn" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white font-body text-sm font-medium rounded-lg hover:bg-brand-primary-hover transition-colors">
          <Plus size={16} /> Add Modifier Group
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 bg-brand-surface border border-brand-border rounded-xl">
          <Settings2 size={40} className="mx-auto text-brand-border mb-3" />
          <p className="font-body text-sm text-brand-text-secondary">No modifier groups yet. Create your first one!</p>
        </div>
      ) : (
        <div data-testid="modifiers-list" className="space-y-4">
          {groups.map((group) => (
            <div key={group.id} data-testid={`mod-group-${group.id}`} className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${group.type === "required" ? "bg-brand-primary/10" : "bg-brand-orange/10"}`}>
                    <Settings2 size={16} className={group.type === "required" ? "text-brand-primary" : "text-brand-orange"} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading text-base font-bold text-brand-text">{group.name}</h3>
                      <span className={`px-2 py-0.5 text-[9px] font-body font-bold uppercase tracking-wider rounded ${group.type === "required" ? "bg-brand-primary text-white" : "bg-brand-bg text-brand-text-secondary border border-brand-border"}`}>
                        {group.type}
                      </span>
                    </div>
                    <p className="font-body text-xs text-brand-text-secondary mt-0.5">
                      {group.options?.length || 0} options &middot;
                      {group.type === "required"
                        ? ` Select ${group.min_selections || 1}`
                        : group.max_selections > 0
                        ? ` Up to ${group.max_selections}`
                        : " No limit"
                      } &middot; {group.linked_item_ids?.length || 0} items linked
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Link to={`/admin/modifiers/${group.id}/edit`} data-testid={`mod-edit-${group.id}`} className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-text-secondary hover:text-brand-primary hover:bg-brand-bg transition-colors">
                    <Pencil size={14} />
                  </Link>
                  <button data-testid={`mod-delete-${group.id}`} onClick={() => handleDelete(group.id)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${deleting === group.id ? "bg-red-500 text-white" : "text-brand-text-secondary hover:text-red-500 hover:bg-red-50"}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {/* Options preview */}
              {group.options?.length > 0 && (
                <div className="border-t border-brand-border px-5 py-3 bg-brand-bg/30">
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((opt) => (
                      <span key={opt.id} data-testid={`mod-opt-preview-${opt.id}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-surface border border-brand-border rounded-lg font-body text-xs">
                        <span className="text-brand-text">{opt.name}</span>
                        {opt.price_adjustment !== 0 && (
                          <span className={`font-semibold ${opt.price_adjustment > 0 ? "text-brand-primary" : "text-green-600"}`}>
                            {opt.price_adjustment > 0 ? `+$${opt.price_adjustment.toFixed(2)}` : `-$${Math.abs(opt.price_adjustment).toFixed(2)}`}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
