import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { X, Loader2, Minus, Plus, Save, Trash2, Percent, Truck, Store, Utensils, MessageSquare, XCircle, History } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API = "/api";

const FULFILLMENT_OPTIONS = [
  { value: "delivery", label: "Delivery", icon: Truck },
  { value: "pickup", label: "Pickup", icon: Store },
  { value: "dine_in", label: "Dine-In", icon: Utensils },
];

export default function AdminModifyOrderDrawer({ open, onClose, orderId, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [draft, setDraft] = useState(null);
  const [menu, setMenu] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [audit, setAudit] = useState([]);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!open || !orderId) return;
    let stopped = false;
    const load = async () => {
      setLoading(true);
      try {
        const [orderResp, auditResp, menuResp] = await Promise.all([
          axios.get(`${API}/orders/${orderId}`),
          axios.get(`${API}/admin/orders/${orderId}/audit`, { withCredentials: true }),
          axios.get(`${API}/menu/items`),
        ]);
        if (stopped) return;
        setOrder(orderResp.data);
        setDraft({
          items: (orderResp.data.items || []).map((it) => ({
            item_id: it.item_id,
            variant_id: it.variant_id || null,
            modifiers: it.modifiers || [],
            qty: it.qty || 1,
            instructions: it.instructions || "",
            name: it.name,
            price: it.price,
          })),
          fulfillment_type: orderResp.data.fulfillment_type,
          address: orderResp.data.address || null,
          table_number: orderResp.data.table_number || "",
          kitchen_notes: orderResp.data.kitchen_notes || "",
          manual_discount: 0,
          manual_discount_reason: "",
          modification_reason: "",
        });
        setAudit(auditResp.data.entries || []);
        const raw = menuResp.data;
        const items = Array.isArray(raw) ? raw : raw.items || [];
        setMenu(items.filter((i) => i.is_available !== false));
      } catch (e) {
        toast.error(e?.response?.data?.detail || "Failed to load order");
      } finally {
        if (!stopped) setLoading(false);
      }
    };
    load();
    return () => { stopped = true; };
  }, [open, orderId]);

  if (!open) return null;

  const setQty = (idx, next) => {
    const items = [...draft.items];
    items[idx] = { ...items[idx], qty: Math.max(1, next) };
    setDraft({ ...draft, items });
  };
  const removeLine = (idx) => {
    const items = draft.items.filter((_, i) => i !== idx);
    setDraft({ ...draft, items });
  };
  const addLine = (m) => {
    setDraft({
      ...draft,
      items: [...draft.items, { item_id: m.id, variant_id: null, modifiers: [], qty: 1, instructions: "", name: m.name, price: m.price }],
    });
    setMenuOpen(false);
  };

  const livePreviewSubtotal = (draft?.items || []).reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0);

  const save = async () => {
    if (!draft.items.length) return toast.error("Order must have at least one item");
    setSaving(true);
    try {
      const payload = {
        items: draft.items.map((it) => ({
          item_id: it.item_id,
          variant_id: it.variant_id,
          modifiers: it.modifiers,
          qty: it.qty,
          instructions: it.instructions,
        })),
        fulfillment_type: draft.fulfillment_type,
        address: draft.fulfillment_type === "delivery" ? draft.address : null,
        table_number: draft.fulfillment_type === "dine_in" ? draft.table_number : null,
        kitchen_notes: draft.kitchen_notes || "",
        modification_reason: draft.modification_reason || "",
      };
      if (Number(draft.manual_discount) > 0) {
        payload.manual_discount = Number(draft.manual_discount);
        payload.manual_discount_reason = draft.manual_discount_reason || "";
      }
      await axios.post(`${API}/admin/orders/${orderId}/modify`, payload, { withCredentials: true });
      toast.success("Order updated");
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  };

  const cancelOrder = async () => {
    if (!window.confirm(`Cancel order ${order?.order_number}? This will refund the customer.`)) return;
    setCancelling(true);
    try {
      await axios.post(`${API}/admin/orders/${orderId}/cancel`, {
        reason_code: "admin_action",
        notes: draft.modification_reason || "",
        refund: true,
      }, { withCredentials: true });
      toast.success("Order cancelled, refund initiated");
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Cancel failed");
    } finally { setCancelling(false); }
  };

  const cancellable = order && !["cancelled", "rejected", "completed", "delivered"].includes(order.status);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <SheetContent data-testid="modify-drawer" className="w-full sm:max-w-2xl p-0 overflow-hidden flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-brand-border flex-shrink-0">
          <SheetTitle className="font-heading">Manage order {order?.order_number || ""}</SheetTitle>
          <SheetDescription className="font-body">Modify items, pricing, or cancel. Every change is logged.</SheetDescription>
        </SheetHeader>

        {loading || !draft ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 size={28} className="animate-spin text-brand-primary" /></div>
        ) : (
          <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
            {/* Items */}
            <Section title="Items" icon={null}>
              <div data-testid="modify-items-list" className="space-y-2">
                {draft.items.map((it, idx) => (
                  <div key={idx} data-testid={`modify-item-row-${idx}`} className="flex items-center gap-3 p-3 border border-brand-border bg-brand-bg rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-sm font-semibold text-brand-text truncate">{it.name}</div>
                      <div className="font-body text-xs text-brand-text-secondary">${Number(it.price || 0).toFixed(2)} each</div>
                    </div>
                    <div className="flex items-center gap-1 border border-brand-border rounded-full overflow-hidden bg-white">
                      <button data-testid={`modify-item-decr-${idx}`} onClick={() => setQty(idx, it.qty - 1)} className="p-2 hover:bg-brand-surface"><Minus size={12} /></button>
                      <span className="w-8 text-center text-sm font-body font-semibold">{it.qty}</span>
                      <button data-testid={`modify-item-incr-${idx}`} onClick={() => setQty(idx, it.qty + 1)} className="p-2 hover:bg-brand-surface"><Plus size={12} /></button>
                    </div>
                    <button data-testid={`modify-item-remove-${idx}`} onClick={() => removeLine(idx)} className="text-brand-text-secondary hover:text-red-600 p-2"><Trash2 size={14} /></button>
                  </div>
                ))}
                {!draft.items.length && <div className="p-4 text-center text-sm text-brand-text-secondary bg-brand-bg border border-dashed border-brand-border rounded-xl">No items.</div>}
              </div>

              <div className="mt-3">
                {!menuOpen ? (
                  <button data-testid="modify-add-item-btn" onClick={() => setMenuOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text font-body text-xs font-medium rounded-full hover:bg-brand-surface"><Plus size={12} /> Add item</button>
                ) : (
                  <div data-testid="modify-menu-picker" className="border border-brand-border rounded-xl max-h-60 overflow-auto bg-white">
                    {menu.map((m) => (
                      <button key={m.id} data-testid={`modify-menu-add-${m.id}`} onClick={() => addLine(m)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-brand-bg text-left border-b border-brand-border last:border-0">
                        <span className="font-body text-sm text-brand-text">{m.name}</span>
                        <span className="font-body text-xs text-brand-text-secondary">${Number(m.price || 0).toFixed(2)}</span>
                      </button>
                    ))}
                    <button onClick={() => setMenuOpen(false)} className="w-full px-3 py-2 text-xs text-brand-text-secondary hover:bg-brand-bg border-t border-brand-border">Close</button>
                  </div>
                )}
                <div className="mt-3 text-right text-xs font-body text-brand-text-secondary">Preview subtotal: <span className="font-semibold text-brand-text">${livePreviewSubtotal.toFixed(2)}</span></div>
              </div>
            </Section>

            {/* Manual discount */}
            <Section title="Manual discount" icon={Percent}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Amount ($)</Label>
                  <Input data-testid="modify-discount-input" type="number" min={0} step="0.01" value={draft.manual_discount} onChange={(e) => setDraft({ ...draft, manual_discount: e.target.value })} className="mt-1.5" />
                </div>
                <div>
                  <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Reason</Label>
                  <Input data-testid="modify-discount-reason-input" value={draft.manual_discount_reason} onChange={(e) => setDraft({ ...draft, manual_discount_reason: e.target.value })} placeholder="Goodwill, wait time, etc." className="mt-1.5" />
                </div>
              </div>
            </Section>

            {/* Fulfillment */}
            <Section title="Fulfillment" icon={Truck}>
              <div className="grid grid-cols-3 gap-2">
                {FULFILLMENT_OPTIONS.map((f) => {
                  const Icon = f.icon;
                  const active = draft.fulfillment_type === f.value;
                  return (
                    <button
                      key={f.value}
                      data-testid={`modify-fulfillment-${f.value}`}
                      onClick={() => setDraft({ ...draft, fulfillment_type: f.value })}
                      className={`p-3 rounded-xl border font-body text-sm flex items-center justify-center gap-2 transition ${active ? "bg-brand-primary text-white border-brand-primary" : "border-brand-border text-brand-text hover:border-brand-primary/50"}`}
                    >
                      <Icon size={14} /> {f.label}
                    </button>
                  );
                })}
              </div>

              {draft.fulfillment_type === "delivery" && (
                <div className="mt-3">
                  <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Delivery address line 1</Label>
                  <Input data-testid="modify-address-input" value={draft.address?.line1 || ""} onChange={(e) => setDraft({ ...draft, address: { ...(draft.address || {}), line1: e.target.value } })} className="mt-1.5" />
                </div>
              )}
              {draft.fulfillment_type === "dine_in" && (
                <div className="mt-3">
                  <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Table number</Label>
                  <Input data-testid="modify-table-input" value={draft.table_number} onChange={(e) => setDraft({ ...draft, table_number: e.target.value })} className="mt-1.5" />
                </div>
              )}
            </Section>

            {/* Kitchen notes */}
            <Section title="Internal kitchen notes" icon={MessageSquare}>
              <Textarea data-testid="modify-kitchen-notes" value={draft.kitchen_notes} onChange={(e) => setDraft({ ...draft, kitchen_notes: e.target.value })} placeholder="e.g. No onions (allergy) — double check" className="min-h-[80px]" />
            </Section>

            {/* Modification reason — required for audit trail */}
            <Section title="Why this change?" icon={MessageSquare}>
              <Input data-testid="modify-reason-input" value={draft.modification_reason} onChange={(e) => setDraft({ ...draft, modification_reason: e.target.value })} placeholder="Visible on the customer's price-adjustment notification" />
            </Section>

            {/* Audit trail */}
            <Section title={`Audit trail · ${audit.length}`} icon={History}>
              {audit.length === 0 ? (
                <div className="p-3 text-xs text-brand-text-secondary italic">No changes yet.</div>
              ) : (
                <div data-testid="audit-trail-list" className="space-y-2 max-h-60 overflow-auto">
                  {audit.map((a) => (
                    <div key={a.id} data-testid={`audit-row-${a.id}`} className="text-xs font-body p-3 bg-brand-bg border border-brand-border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold capitalize">{a.action.replace(/_/g, " ")}</span>
                        <span className="text-brand-text-secondary">{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-brand-text-secondary mt-0.5">{a.actor_name} · {a.actor_role}</div>
                      {a.reason && <div className="text-brand-text italic mt-1">"{a.reason}"</div>}
                      {a.changes && Object.keys(a.changes).length > 0 && (
                        <pre className="mt-1 text-[10px] bg-white p-2 rounded border border-brand-border overflow-auto">{JSON.stringify(a.changes, null, 2)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}

        {/* Footer */}
        {!loading && draft && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-brand-border flex items-center justify-between bg-brand-surface">
            {cancellable ? (
              <button
                data-testid="modify-cancel-order-btn"
                onClick={cancelOrder}
                disabled={cancelling}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-700 font-body text-sm font-semibold rounded-full hover:bg-red-50 disabled:opacity-50"
              >
                {cancelling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Cancel &amp; refund
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button onClick={onClose} data-testid="modify-close-btn" className="px-4 py-2 border border-brand-border text-brand-text-secondary font-body text-sm font-medium rounded-full hover:bg-brand-surface">Close</button>
              <button
                onClick={save}
                disabled={saving}
                data-testid="modify-save-btn"
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save changes
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <section>
      <h3 className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold mb-2 inline-flex items-center gap-1.5">
        {Icon && <Icon size={12} />} {title}
      </h3>
      {children}
    </section>
  );
}
