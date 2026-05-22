import { forwardRef } from "react";

const TICKET_STYLES = `
  @page { size: 80mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .receipt { width: 72mm; margin: 0 auto; padding: 4mm 3mm; color: #000;
    font-family: "Courier New", "Lucida Console", monospace; font-size: 12px; line-height: 1.4; }
  .receipt .center { text-align: center; }
  .receipt .right { text-align: right; }
  .receipt .bold { font-weight: 800; }
  .receipt .hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .receipt .hr-solid { border: 0; border-top: 2px solid #000; margin: 6px 0; }
  .receipt h1 { font-size: 15px; margin: 0 0 2px; letter-spacing: 2px; }
  .receipt h2 { font-size: 12px; margin: 0; font-weight: 400; font-style: italic; }
  .receipt .logo { font-family: Georgia, serif; font-size: 18px; letter-spacing: 1.5px; margin: 2px 0 4px; }
  .receipt .kvs { display:flex; justify-content:space-between; gap: 8px; }
  .receipt .item { display:flex; justify-content:space-between; gap: 8px; margin-top: 3px; }
  .receipt .item .qty { font-weight: 800; min-width: 20px; }
  .receipt .item .name { flex: 1; }
  .receipt .item .price { text-align: right; min-width: 52px; font-variant-numeric: tabular-nums; }
  .receipt .mod { font-size: 11px; color: #333; padding-left: 22px; }
  .receipt .total-row { display:flex; justify-content:space-between; font-weight:800; font-size: 13px; margin-top: 4px; }
  .receipt .footer { margin-top: 10px; font-size: 11px; }
  @media print { .no-print { display: none !important; } }
`;

const fmt = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const badgeFor = (t) => ({ delivery: "Delivery", pickup: "Pick-up", dine_in: "Dine-in" })[t] || (t || "Order");
function fmtTime(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
}

const CustomerReceipt = forwardRef(function CustomerReceipt({ ticket }, ref) {
  if (!ticket?.order) return null;
  const o = ticket.order;
  const items = o.items || [];
  const sub = Number(o.subtotal ?? 0);
  const tax = Number(o.tax ?? 0);
  const delivery = Number(o.delivery_fee ?? 0);
  const discount = Number(o.discount ?? 0);
  const total = Number(o.total ?? 0);
  const paymentMethod = o.payment_method || "Card";
  return (
    <>
      <style>{TICKET_STYLES}</style>
      <div ref={ref} data-testid="customer-receipt" className="receipt">
        <div className="center">
          <div className="logo">{ticket.brand?.name || "Restaurant"}</div>
          <h2>{ticket.brand?.tagline || ""}</h2>
        </div>
        <hr className="hr" />

        <div className="kvs"><span>Order #</span><span className="bold" data-testid="receipt-order-number">{o.order_number || o.id?.slice(0, 6)}</span></div>
        <div className="kvs"><span>Type</span><span>{badgeFor(o.fulfillment_type)}</span></div>
        <div className="kvs"><span>Date</span><span>{fmtTime(o.created_at)}</span></div>
        {o.contact_name && <div className="kvs"><span>Customer</span><span>{o.contact_name}</span></div>}
        {o.contact_email && <div className="kvs"><span>Email</span><span>{o.contact_email}</span></div>}

        <hr className="hr" />
        <div className="bold center">— ORDER SUMMARY —</div>
        {items.map((it, idx) => {
          const qty = it.quantity || 1;
          const price = Number(it.line_total ?? (it.price || 0) * qty);
          return (
            <div key={`${it.item_id || it.name || "item"}-${it.variant?.id || ""}-${idx}`}>
              <div className="item">
                <span className="qty">{qty}×</span>
                <span className="name">{it.name || it.item_name || "Item"}</span>
                <span className="price">{fmt(price)}</span>
              </div>
              {(it.variant_name || it.variant?.name) && (<div className="mod">› {it.variant_name || it.variant?.name}</div>)}
              {Array.isArray(it.modifiers) && it.modifiers.map((m, mi) => (
                <div key={`${m.name || m || "mod"}-${mi}`} className="mod">+ {m.name || m}</div>
              ))}
              {it.special_instructions && <div className="mod">note: {it.special_instructions}</div>}
            </div>
          );
        })}

        <hr className="hr" />
        <div className="kvs"><span>Subtotal</span><span>{fmt(sub)}</span></div>
        {tax > 0 && <div className="kvs"><span>Tax</span><span>{fmt(tax)}</span></div>}
        {delivery > 0 && <div className="kvs"><span>Delivery</span><span>{fmt(delivery)}</span></div>}
        {discount > 0 && <div className="kvs"><span>Discount{o.promo_applied ? ` (${o.promo_applied})` : ""}</span><span>-{fmt(discount)}</span></div>}
        <hr className="hr-solid" />
        <div className="total-row"><span>TOTAL</span><span data-testid="receipt-total">{fmt(total)}</span></div>
        <div className="kvs" style={{ marginTop: 4 }}><span>Paid via</span><span className="bold">{paymentMethod.toUpperCase()}</span></div>

        <hr className="hr" />
        <div className="center footer">
          <div className="bold">THANK YOU!</div>
          <div>We hope to serve you again.</div>
          <div style={{ marginTop: 4 }}>— {ticket.brand?.name} —</div>
        </div>
      </div>
    </>
  );
});

export default CustomerReceipt;
