import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { X, XCircle, AlertTriangle, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const API = "/api";

/** Visible only within the configurable window. Shows a live countdown. */
export default function CancelOrderButton({ order, onCancelled }) {
  const [elig, setElig] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1); // 1 = reason, 2 = confirm, 3 = success
  const [reasonCode, setReasonCode] = useState("changed_mind");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const requireReason = elig?.reason_required !== false;
  const openDialog = () => {
    setStep(requireReason ? 1 : 2);
    setOpen(true);
  };

  const fetchElig = useCallback(async () => {
    if (!order?.id || order.status === "cancelled") return;
    try {
      const { data } = await axios.get(`${API}/orders/${order.id}/cancel-eligibility`);
      setElig(data);
    } catch {
      setElig(null);
    }
  }, [order?.id, order?.status]);

  useEffect(() => { fetchElig(); }, [fetchElig]);

  // Tick every second to update countdown
  useEffect(() => {
    if (!elig?.eligible) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [elig?.eligible]);

  // If the window closes while we've been polling, refresh eligibility to hide the button
  useEffect(() => {
    if (!elig?.eligible) return;
    if (secondsLeft() <= 0) fetchElig();
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  function secondsLeft() {
    if (!elig) return 0;
    // Derive from order.created_at + window_minutes so the tick feels continuous
    const placed = order?.created_at ? Date.parse(order.created_at) : now;
    const endMs = placed + (elig.window_minutes || 0) * 60 * 1000;
    return Math.max(0, Math.floor((endMs - now) / 1000));
  }

  if (!order) return null;

  // Don't show on already-cancelled / rejected / completed orders
  if (["cancelled", "rejected", "completed", "delivered"].includes(order.status)) return null;
  if (!elig?.eligible) return null;

  const mm = Math.floor(secondsLeft() / 60);
  const ss = secondsLeft() % 60;

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API}/orders/${order.id}/cancel`, {
        reason_code: reasonCode,
        notes,
      });
      setResult(data);
      setStep(3);
      toast.success("Order cancelled");
      onCancelled?.(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Cancel failed");
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    setOpen(false);
    setTimeout(() => { setStep(requireReason ? 1 : 2); setNotes(""); setReasonCode("changed_mind"); setResult(null); }, 250);
  };

  return (
    <>
      <div data-testid="cancel-window-card" className="mb-6 p-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-heading font-bold text-amber-900">Made a mistake?</div>
            <div className="font-body text-xs text-amber-800 mt-0.5">
              You can cancel this order for a full refund within the next <span data-testid="cancel-countdown" className="font-mono font-semibold">{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</span>.
            </div>
          </div>
        </div>
        <button
          data-testid="cancel-order-open-btn"
          onClick={openDialog}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-red-600 text-white font-body text-sm font-semibold rounded-full hover:bg-red-700 transition"
        >
          <XCircle size={14} /> Cancel order
        </button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
        <DialogContent data-testid="cancel-dialog" className="sm:max-w-lg">
          {step === 1 && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading">Why are you cancelling?</DialogTitle>
                <DialogDescription className="font-body">A quick reason helps us improve. Your refund is instant either way.</DialogDescription>
              </DialogHeader>
              <RadioGroup value={reasonCode} onValueChange={setReasonCode} className="mt-4 space-y-2" data-testid="cancel-reason-group">
                {(elig.reasons || []).map((r) => (
                  <label key={r.code} data-testid={`cancel-reason-${r.code}`} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${reasonCode === r.code ? "border-brand-primary bg-brand-primary/5" : "border-brand-border hover:bg-brand-surface"}`}>
                    <RadioGroupItem value={r.code} />
                    <span className="font-body text-sm text-brand-text">{r.label}</span>
                  </label>
                ))}
              </RadioGroup>
              <div className="mt-4">
                <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Tell us more (optional)</Label>
                <Textarea data-testid="cancel-notes-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything we should know?" className="mt-1.5 min-h-[72px]" />
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <button onClick={close} data-testid="cancel-dialog-back-btn" className="px-4 py-2 border border-brand-border text-brand-text-secondary font-body text-sm rounded-full hover:bg-brand-surface">Keep order</button>
                <button onClick={() => setStep(2)} data-testid="cancel-dialog-next-btn" className="px-5 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover">Continue</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading">Confirm cancellation</DialogTitle>
                <DialogDescription className="font-body">You'll get a full refund to your original payment method.</DialogDescription>
              </DialogHeader>
              <div data-testid="cancel-refund-summary" className="mt-4 bg-brand-bg border border-brand-border rounded-xl p-4 space-y-2">
                <RefundRow label="Order" value={order.order_number} />
                <RefundRow label="Refund amount" value={`$${Number(order.total || 0).toFixed(2)}`} bold />
                <RefundRow label="Refund method" value="Original payment" />
                <RefundRow label="Estimated to arrive" value="3–5 business days" />
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <button onClick={() => requireReason ? setStep(1) : close()} data-testid="cancel-confirm-back-btn" className="px-4 py-2 border border-brand-border text-brand-text-secondary font-body text-sm rounded-full hover:bg-brand-surface">{requireReason ? "Back" : "Keep order"}</button>
                <button
                  onClick={submit}
                  disabled={submitting}
                  data-testid="cancel-confirm-submit-btn"
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-red-600 text-white font-body text-sm font-semibold rounded-full hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Cancel order
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div data-testid="cancel-success-state" className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-green-50 border-2 border-green-200 inline-flex items-center justify-center mb-3">
                  <CheckCircle2 size={28} className="text-green-600" />
                </div>
                <h3 className="font-heading text-xl font-bold text-brand-text mb-1">Order cancelled</h3>
                <p className="font-body text-sm text-brand-text-secondary mb-4">
                  {result?.refund ? (
                    <>A refund of <span className="font-semibold">${Number(result.refund.amount || 0).toFixed(2)}</span> has been initiated to your original payment method.</>
                  ) : result?.refund_pending ? (
                    <>Your refund will be processed shortly and show in your account within 3–5 business days.</>
                  ) : (
                    <>Cancellation confirmed.</>
                  )}
                </p>
                <button onClick={close} data-testid="cancel-success-close-btn" className="px-5 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover">Done</button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RefundRow({ label, value, bold }) {
  return (
    <div className="flex justify-between text-sm font-body">
      <span className="text-brand-text-secondary">{label}</span>
      <span className={`${bold ? "font-bold text-brand-text text-base" : "text-brand-text"}`}>{value}</span>
    </div>
  );
}

/** Small banner shown on the tracking page when admin modifies the order total. */
export function PriceAdjustmentBanner({ order, onAcknowledge }) {
  const notif = order?.modification_notification;
  if (!notif || notif.shown) return null;
  const delta = Number(notif.new_total || 0) - Number(notif.old_total || 0);
  const cheaper = delta < 0;
  return (
    <div data-testid="modification-banner" className={`mb-6 p-4 rounded-xl border-2 flex items-start gap-3 ${cheaper ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
      <RefreshCw size={18} className={`mt-0.5 flex-shrink-0 ${cheaper ? "text-green-600" : "text-amber-700"}`} />
      <div className="flex-1">
        <div className={`font-heading font-bold ${cheaper ? "text-green-800" : "text-amber-900"}`}>The kitchen adjusted your order</div>
        <div className="font-body text-xs mt-0.5 text-brand-text">
          New total <span className="font-semibold">${Number(notif.new_total || 0).toFixed(2)}</span>
          <span className="text-brand-text-secondary"> (was ${Number(notif.old_total || 0).toFixed(2)})</span>
          {notif.reason && <span className="block mt-1 italic text-brand-text-secondary">{notif.reason}</span>}
        </div>
      </div>
      <button data-testid="modification-dismiss-btn" onClick={onAcknowledge} className="text-brand-text-secondary hover:text-brand-text"><X size={16} /></button>
    </div>
  );
}
