import { useEffect, useState } from "react";
import { Truck, Store, Utensils, Clock, Check, X, AlertTriangle, Printer, Ban } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API = "/api";

const FULFILL_ICON = { delivery: Truck, pickup: Store, dine_in: Utensils };

function ago(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function minutesSince(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export default function OrderCard({
  order, lane, onAccept, onReject, onAdvance, onReprint,
  selectable = false, selected = false, onToggleSelect,
  escalated = false,
}) {
  const Icon = FULFILL_ICON[order.fulfillment_type] || Store;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const acceptedMins = minutesSince(order.accepted_at);
  const items = order.items || [];
  const hasNotes = items.some((i) => i.instructions || i.special_instructions);

  const actionBtn = (() => {
    if (lane === "incoming") return (
      <>
        <button
          data-testid={`accept-${order.id}`}
          onClick={() => onAccept?.(order.id)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition"
        >
          <Check size={14} /> Accept
        </button>
        <button
          data-testid={`reject-${order.id}`}
          onClick={() => onReject?.(order.id)}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition"
        >
          <X size={14} /> Reject
        </button>
      </>
    );
    if (lane === "preparing") return (
      <button
        data-testid={`mark-ready-${order.id}`}
        onClick={() => onAdvance?.(order.id)}
        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition"
      >
        Mark Ready
      </button>
    );
    if (lane === "ready") return (
      <button
        data-testid={`mark-out-${order.id}`}
        onClick={() => onAdvance?.(order.id)}
        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition"
      >
        {order.fulfillment_type === "delivery" ? "Out for delivery" : order.fulfillment_type === "pickup" ? "Mark picked up" : "Mark completed"}
      </button>
    );
    if (lane === "out_for_delivery") return (
      <button
        data-testid={`mark-delivered-${order.id}`}
        onClick={() => onAdvance?.(order.id)}
        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-green-700 text-white text-xs font-semibold rounded-lg hover:bg-green-800 transition"
      >
        Mark Delivered
      </button>
    );
    return null;
  })();

  const laneBorderCls = {
    incoming: `border-red-300 ${escalated ? "animate-pulse shadow-red-200 shadow-lg" : ""}`,
    preparing: "border-amber-300",
    ready: "border-green-300",
    out_for_delivery: "border-indigo-300",
    completed: "border-gray-200 opacity-70",
  }[lane] || "border-brand-border";

  return (
    <div data-testid={`queue-card-${order.id}`} className={`bg-white border-2 rounded-xl p-4 ${laneBorderCls} transition`} data-lane={lane} data-tick={tick}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {selectable && (
            <input
              type="checkbox"
              data-testid={`select-${order.id}`}
              checked={!!selected}
              onChange={() => onToggleSelect?.(order.id)}
              className="accent-brand-primary w-4 h-4"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div>
            <div className="font-heading text-base font-bold text-brand-text">{order.order_number || order.id.slice(0, 6)}</div>
            <div className="text-xs text-brand-text-secondary flex items-center gap-1.5 flex-wrap">
              {order.contact_name || order.contact_email || "Guest"}
              {!order.user_id && (
                <span data-testid={`guest-badge-${order.id}`} className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-body font-bold uppercase tracking-wider">Guest</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary font-semibold uppercase tracking-wider">
            <Icon size={11} /> {order.fulfillment_type === "dine_in" ? `Table ${order.table_number || "-"}` : order.fulfillment_type}
          </span>
          <span className="text-[10px] text-brand-text-secondary mt-1 inline-flex items-center gap-1">
            <Clock size={10} /> {ago(order.created_at)}
          </span>
        </div>
      </div>

      {escalated && lane === "incoming" && (
        <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-1 rounded">
          <AlertTriangle size={12} /> Waiting too long — please accept or reject
        </div>
      )}

      <ul className="text-xs text-brand-text space-y-1 mb-3">
        {items.slice(0, 4).map((it, idx) => {
          const note = it.instructions || it.special_instructions;
          const itemId = it.item_id || it.id;
          const quick86 = async (e) => {
            e.stopPropagation();
            if (!itemId) return;
            if (!window.confirm(`86 "${it.name}" — mark sold out on storefront?`)) return;
            try {
              await axios.post(`${API}/admin/86/items/${itemId}/toggle`, { status: "sold_out", source: "queue" }, { withCredentials: true });
              toast.success(`${it.name} marked sold out`);
            } catch { toast.error("Could not 86 item"); }
          };
          return (
            <li key={idx} className="flex items-start gap-1.5 group/item">
              <span className="font-bold text-brand-text-secondary">{it.qty || it.quantity || 1}×</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate flex-1">{it.name || "Item"}{it.variant_name ? ` · ${it.variant_name}` : ""}</span>
                  {itemId && (
                    <button
                      data-testid={`quick-86-${order.id}-${idx}`}
                      onClick={quick86}
                      title="Mark sold out on storefront"
                      className="md:opacity-0 md:group-hover/item:opacity-100 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded hover:bg-red-700 transition"
                    >
                      <Ban size={9} /> 86
                    </button>
                  )}
                </div>
                {Array.isArray(it.modifiers) && it.modifiers.length > 0 && (
                  <div className="text-[10px] text-brand-text-secondary">+ {it.modifiers.map((m) => m.name || m).join(", ")}</div>
                )}
                {note && <div className="mt-0.5 text-[11px] font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded inline-block">❖ {note}</div>}
              </div>
            </li>
          );
        })}
        {items.length > 4 && <li className="text-[10px] text-brand-text-secondary">+ {items.length - 4} more items</li>}
      </ul>

      {lane === "preparing" && acceptedMins > 0 && (
        <div className="text-[11px] text-brand-text-secondary mb-2">In kitchen {acceptedMins}m</div>
      )}

      <div className="flex items-center gap-2 mt-2">
        {actionBtn}
        <button
          data-testid={`reprint-${order.id}`}
          onClick={() => onReprint?.(order.id)}
          className="inline-flex items-center justify-center p-2 rounded-lg border border-brand-border text-brand-text-secondary hover:text-brand-primary hover:border-brand-primary/40 transition"
          title="Reprint kitchen ticket"
        >
          <Printer size={14} />
        </button>
      </div>

      {hasNotes && <div className="sr-only">has-notes</div>}
    </div>
  );
}
