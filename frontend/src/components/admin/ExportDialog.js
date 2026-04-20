import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileText, DollarSign, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";

const REPORTS = [
  { key: "orders", label: "Orders", description: "One row per paid order with totals + customer.", icon: FileText },
  { key: "revenue", label: "Revenue", description: "Daily revenue, order count, and AOV.", icon: DollarSign },
  { key: "items", label: "Items sold", description: "Per-item quantity & revenue across the period.", icon: Package },
];

function defaultRange() {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
}

export default function ExportDialog({ open, onClose }) {
  const [reportKey, setReportKey] = useState("orders");
  const initial = defaultRange();
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (!reportKey || !start || !end) return;
    setBusy(true);
    try {
      const startIso = new Date(start + "T00:00:00Z").toISOString();
      const endIso = new Date(end + "T23:59:59Z").toISOString();
      const url = `/api/admin/reports/export?type=${reportKey}&start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      const fname = `${reportKey}_${start.replace(/-/g, "")}_${end.replace(/-/g, "")}.csv`;
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`Exported ${fname}`);
      onClose?.();
    } catch (e) {
      toast.error("Export failed", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent data-testid="export-dialog" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl text-brand-text">Export report (CSV)</DialogTitle>
          <DialogDescription>Download a CSV for orders, revenue, or items within a date range.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2" data-testid="export-type-list">
          {REPORTS.map(({ key, label, description, icon: Icon }) => {
            const active = key === reportKey;
            return (
              <button
                key={key}
                data-testid={`export-type-${key}`}
                onClick={() => setReportKey(key)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition ${active ? "border-brand-primary bg-brand-primary/5" : "border-brand-border hover:border-brand-primary/40"}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? "bg-brand-primary text-white" : "bg-brand-bg text-brand-primary"}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1">
                  <div className="font-heading text-sm font-bold text-brand-text">{label}</div>
                  <div className="text-[11px] text-brand-text-secondary">{description}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-1">
          <div>
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Start</Label>
            <Input data-testid="export-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">End</Label>
            <Input data-testid="export-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        <button
          data-testid="export-download-btn"
          onClick={download}
          disabled={busy}
          className="mt-4 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Download CSV
        </button>
      </DialogContent>
    </Dialog>
  );
}
