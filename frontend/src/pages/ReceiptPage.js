import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { Printer, Loader2, ArrowLeft } from "lucide-react";
import CustomerReceipt from "@/components/tickets/CustomerReceipt";

const API = "/api";

export default function ReceiptPage() {
  const { order_id } = useParams();
  const [params] = useSearchParams();
  const autoPrint = params.get("auto") === "1";
  const [ticket, setTicket] = useState(null);
  const [err, setErr] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    axios.get(`${API}/orders/${order_id}/receipt`)
      .then(({ data }) => { if (alive) setTicket(data); })
      .catch((e) => { if (alive) setErr(e?.response?.data?.detail || "Could not load receipt"); });
    return () => { alive = false; };
  }, [order_id]);

  useEffect(() => {
    if (autoPrint && ticket) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [autoPrint, ticket]);

  if (err) return (
    <div data-testid="receipt-error" className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p className="font-body text-brand-text mb-3">{err}</p>
        <Link to="/orders" className="font-body text-sm text-brand-primary underline">Back to orders</Link>
      </div>
    </div>
  );
  if (!ticket) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-brand-primary" />
    </div>
  );

  return (
    <div data-testid="receipt-page" className="min-h-screen bg-brand-surface py-8 print:py-0 print:bg-white">
      <div className="no-print max-w-sm mx-auto mb-4 flex items-center justify-between px-4">
        <Link to="/orders" className="inline-flex items-center gap-1.5 text-sm text-brand-text-secondary hover:text-brand-primary" data-testid="receipt-back-link">
          <ArrowLeft size={14} /> Back
        </Link>
        <button
          data-testid="receipt-print-btn"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover transition"
        >
          <Printer size={14} /> Print
        </button>
      </div>
      <div className="bg-white mx-auto shadow print:shadow-none" style={{ width: "80mm" }}>
        <CustomerReceipt ticket={ticket} ref={ref} />
      </div>
    </div>
  );
}
