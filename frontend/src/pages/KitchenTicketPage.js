import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { Printer, Loader2, ArrowLeft } from "lucide-react";
import KitchenTicket from "@/components/tickets/KitchenTicket";
import CustomerReceipt from "@/components/tickets/CustomerReceipt";

const API = "/api";

/** Admin-only full-page ticket preview. Auto-prints when ?auto=1. */
export default function KitchenTicketPage() {
  const { order_id } = useParams();
  const [params] = useSearchParams();
  const ticketType = params.get("type") === "receipt" ? "receipt" : "kitchen";
  const printerId = params.get("printer_id") || null;
  const trigger = params.get("trigger") || "reprint";
  const autoPrint = params.get("auto") === "1";

  const [ticket, setTicket] = useState(null);
  const [err, setErr] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    axios.post(
      `${API}/admin/orders/${order_id}/print`,
      { ticket_type: ticketType, printer_id: printerId, trigger },
      { withCredentials: true },
    )
      .then(({ data }) => { if (alive) setTicket(data.ticket); })
      .catch((e) => { if (alive) setErr(e?.response?.data?.detail || "Could not load ticket"); });
    return () => { alive = false; };
  // eslint-disable-next-line
  }, [order_id, ticketType, printerId]);

  useEffect(() => {
    if (autoPrint && ticket) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [autoPrint, ticket]);

  if (err) return (
    <div data-testid="kitchen-ticket-error" className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p className="font-body text-brand-text mb-3">{err}</p>
        <Link to="/admin/orders" className="font-body text-sm text-brand-primary underline">Back to orders</Link>
      </div>
    </div>
  );
  if (!ticket) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-brand-primary" />
    </div>
  );

  const Component = ticketType === "receipt" ? CustomerReceipt : KitchenTicket;

  return (
    <div data-testid="kitchen-ticket-page" className="min-h-screen bg-brand-surface py-8 print:py-0 print:bg-white">
      <div className="no-print max-w-sm mx-auto mb-4 flex items-center justify-between px-4">
        <Link to="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-brand-text-secondary hover:text-brand-primary" data-testid="ticket-back-link">
          <ArrowLeft size={14} /> Back
        </Link>
        <button
          data-testid="ticket-print-btn"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover transition"
        >
          <Printer size={14} /> Print
        </button>
      </div>
      <div className="bg-white mx-auto shadow print:shadow-none" style={{ width: "80mm" }}>
        <Component ticket={ticket} ref={ref} />
      </div>
    </div>
  );
}
