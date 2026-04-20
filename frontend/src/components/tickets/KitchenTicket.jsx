import { forwardRef } from "react";

/** 80mm thermal kitchen ticket — renders ONLY in print CSS / isolated page.
 *  Passes all data via `ticket` (payload from /api/admin/orders/:id/print or /api/orders/:id/receipt).
 */
const TICKET_STYLES = `
  @page { size: 80mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .ticket { width: 72mm; margin: 0 auto; padding: 4mm 3mm; color: #000;
    font-family: "Courier New", "Lucida Console", monospace; font-size: 12px; line-height: 1.35; }
  .ticket .center { text-align: center; }
  .ticket .right { text-align: right; }
  .ticket .bold { font-weight: 800; }
  .ticket .hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .ticket .hr-solid { border: 0; border-top: 2px solid #000; margin: 6px 0; }
  .ticket h1 { font-size: 15px; margin: 0 0 2px; letter-spacing: .4px; }
  .ticket h2 { font-size: 13px; margin: 0; }
  .ticket .badge { display: inline-block; border: 2px solid #000; padding: 2px 8px; font-weight: 800; letter-spacing: 2px; }
  .ticket .kvs { display:flex; justify-content:space-between; gap: 8px; }
  .ticket .item { margin-top: 6px; }
  .ticket .item-name { font-weight: 800; text-transform: uppercase; font-size: 13px; }
  .ticket .item-qty { display:inline-block; min-width:18px; font-weight:800; }
  .ticket .mod { margin-left: 18px; font-size: 11px; }
  .ticket .notes { margin-left: 18px; font-weight: 800; font-size: 12px; }
  .ticket .footer { margin-top: 10px; font-size: 11px; }
  @media print { .no-print { display: none !important; } }
`;

const badgeFor = (t) => ({ delivery: "DELIVERY", pickup: "PICK-UP", dine_in: "DINE-IN" })[t] || (t || "ORDER").toUpperCase();

function fmtTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

const KitchenTicket = forwardRef(function KitchenTicket({ ticket }, ref) {
  if (!ticket?.order) return null;
  const o = ticket.order;
  const items = o.items || [];
  return (
    <>
      <style>{TICKET_STYLES}</style>
      <div ref={ref} data-testid="kitchen-ticket" className="ticket">
        <div className="center">
          <h1 className="bold">KITCHEN TICKET</h1>
          <div>{ticket.brand?.name || "Restaurant"}</div>
        </div>
        <hr className="hr" />

        <div className="center">
          <span className="badge" data-testid="ticket-fulfillment-badge">{badgeFor(o.fulfillment_type)}</span>
        </div>

        <div className="item" style={{ marginTop: 8 }}>
          <div className="kvs"><span className="bold">ORDER</span><span className="bold" data-testid="ticket-order-number">{o.order_number || o.id?.slice(0, 6)}</span></div>
          <div className="kvs"><span>TIME</span><span>{fmtTime(ticket.printed_at || o.created_at)}</span></div>
          {o.table_number && <div className="kvs"><span>TABLE</span><span className="bold">#{o.table_number}</span></div>}
          {o.scheduled_slot && o.scheduled_slot !== "ASAP" && <div className="kvs"><span>SLOT</span><span>{o.scheduled_slot}</span></div>}
          {o.contact_name && <div className="kvs"><span>CUSTOMER</span><span>{o.contact_name}</span></div>}
          {ticket.printer?.name && <div className="kvs"><span>PRINTER</span><span>{ticket.printer.name}</span></div>}
        </div>

        {o.fulfillment_type === "delivery" && o.address && (
          <>
            <hr className="hr" />
            <div className="bold">DELIVERY ADDRESS</div>
            <div>{o.address.line1}{o.address.line2 ? `, ${o.address.line2}` : ""}</div>
            <div>{[o.address.city, o.address.state, o.address.postal_code].filter(Boolean).join(", ")}</div>
            {o.contact_phone && <div>Tel: {o.contact_phone}</div>}
          </>
        )}

        <hr className="hr-solid" />
        <div className="bold">ITEMS ({items.length})</div>
        {items.map((it, idx) => (
          <div key={idx} className="item" data-testid={`ticket-item-${idx}`}>
            <div className="item-name">
              <span className="item-qty">{it.quantity || 1}×</span>{" "}
              {it.name || it.item_name || "Item"}
            </div>
            {(it.variant_name || it.variant?.name) && (
              <div className="mod">› {it.variant_name || it.variant?.name}</div>
            )}
            {Array.isArray(it.modifiers) && it.modifiers.length > 0 && it.modifiers.map((m, mi) => (
              <div key={mi} className="mod">+ {m.name || m}</div>
            ))}
            {it.special_instructions && (
              <div className="notes">** {it.special_instructions.toUpperCase()} **</div>
            )}
          </div>
        ))}

        <hr className="hr" />
        <div className="center footer">
          *** END OF TICKET ***
        </div>
      </div>
    </>
  );
});

export default KitchenTicket;
