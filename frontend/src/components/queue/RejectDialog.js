import { X } from "lucide-react";
import { useState } from "react";

const REASONS = [
  "Out of stock",
  "Kitchen closed",
  "Too busy",
  "Other",
];

export default function RejectDialog({ open, onClose, onConfirm, orderNumber }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  if (!open) return null;
  const finalReason = reason === "Other" ? (note.trim() ? `Other — ${note.trim()}` : "Other") : reason;
  return (
    <div data-testid="reject-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-brand-border">
          <h2 className="font-heading text-base font-bold text-brand-text">Reject order {orderNumber}</h2>
          <button onClick={onClose} data-testid="reject-dialog-close" className="text-brand-text-secondary"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-brand-text-secondary font-semibold mb-1.5">Reason *</div>
            <div className="space-y-1.5">
              {REASONS.map((r) => (
                <label
                  key={r}
                  data-testid={`reject-reason-${r.toLowerCase().replace(/\s+/g, "-")}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${reason === r ? "border-brand-primary bg-brand-primary/5" : "border-brand-border"}`}
                >
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-brand-primary" />
                  {r}
                </label>
              ))}
            </div>
          </div>
          {reason === "Other" && (
            <input
              data-testid="reject-other-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a short note"
              className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
            />
          )}
        </div>
        <div className="p-4 border-t border-brand-border flex justify-end gap-2">
          <button onClick={onClose} data-testid="reject-dialog-cancel" className="px-4 py-2 text-sm text-brand-text-secondary">Cancel</button>
          <button
            data-testid="reject-dialog-confirm"
            onClick={() => onConfirm(finalReason)}
            className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-full hover:bg-red-700"
          >Reject order</button>
        </div>
      </div>
    </div>
  );
}
