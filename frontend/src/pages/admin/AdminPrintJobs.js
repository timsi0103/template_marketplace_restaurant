import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Printer, RefreshCw, Eye, Receipt as ReceiptIcon } from "lucide-react";

const API = "/api";

const TRIGGER_LABEL = {
  manual: "Manual",
  reprint: "Reprint",
  test: "Test",
  auto_placement: "Auto · on placement",
  auto_acceptance: "Auto · on acceptance",
};

const TYPE_LABEL = { kitchen: "Kitchen", receipt: "Receipt", test: "Test" };

function fmt(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

export default function AdminPrintJobs() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);

  const load = async () => {
    try {
      const { data } = await axios.get(`${API}/admin/print-jobs`, { withCredentials: true });
      setJobs(data.jobs || []);
    } catch { toast.error("Could not load print jobs"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <div data-testid="admin-print-jobs-page" className="p-6 sm:p-10 max-w-6xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-brand-text">Print History</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">Every ticket queued, auto or manual. Click to view or reprint.</p>
        </div>
        <button onClick={load} data-testid="refresh-jobs-btn" className="inline-flex items-center gap-2 text-sm text-brand-text-secondary hover:text-brand-primary">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 size={28} className="animate-spin text-brand-primary" /></div>
      ) : jobs.length === 0 ? (
        <div data-testid="no-print-jobs" className="bg-brand-surface border border-dashed border-brand-border rounded-xl p-10 text-center">
          <Printer size={32} className="mx-auto mb-3 text-brand-text-secondary" />
          <p className="font-body text-sm text-brand-text-secondary">No tickets have been queued yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-brand-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-surface text-left">
                <tr>
                  <th className="p-3 font-semibold">When</th>
                  <th className="p-3 font-semibold">Order</th>
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold">Printer</th>
                  <th className="p-3 font-semibold">Trigger</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} data-testid={`print-job-${j.id}`} className="border-t border-brand-border">
                    <td className="p-3 whitespace-nowrap">{fmt(j.created_at)}</td>
                    <td className="p-3 font-mono text-xs">{j.order_number || "—"}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 text-xs">
                        {j.ticket_type === "receipt" ? <ReceiptIcon size={12} /> : <Printer size={12} />}
                        {TYPE_LABEL[j.ticket_type] || j.ticket_type}
                      </span>
                    </td>
                    <td className="p-3">{j.printer_name || "—"}{j.printer_station && <span className="ml-1 text-[10px] uppercase tracking-wider text-brand-text-secondary">· {j.printer_station}</span>}</td>
                    <td className="p-3"><span className="text-xs text-brand-text-secondary">{TRIGGER_LABEL[j.trigger] || j.trigger}</span></td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {j.order_id ? (
                        <Link
                          data-testid={`view-ticket-${j.id}`}
                          to={`/admin/ticket/${j.order_id}?type=${j.ticket_type === "receipt" ? "receipt" : "kitchen"}&trigger=reprint${j.printer_id ? `&printer_id=${j.printer_id}` : ""}`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand-primary text-xs font-semibold"
                        >
                          <Eye size={12} /> Open
                        </Link>
                      ) : <span className="text-xs text-brand-text-secondary">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
