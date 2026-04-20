import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, BellOff, CheckCircle2, XCircle, Clock, Truck, Store, Utensils } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API = "/api";
const POLL_INTERVAL = 6000;

// ─── Generated chime via Web Audio (no external asset) ─
function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const tones = [880, 660];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.linearRampToValueAtTime(0, start + 0.16);
      osc.start(start);
      osc.stop(start + 0.18);
    });
    setTimeout(() => ctx.close && ctx.close(), 600);
  } catch { /* noop */ }
}

const fulfillmentIcon = {
  delivery: Truck, pickup: Store, dine_in: Utensils,
};

export default function AdminNewOrdersPanel() {
  const [orders, setOrders] = useState([]);
  const [muted, setMuted] = useState(() => localStorage.getItem("admin_muted") === "1");
  const [loading, setLoading] = useState(true);
  const sinceRef = useRef(new Date(0).toISOString());
  const seenIds = useRef(new Set());

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem("admin_muted", next ? "1" : "0");
      return next;
    });
  };

  const fetchNew = async () => {
    try {
      const { data } = await axios.get(`${API}/admin/orders/new`, {
        params: { since: sinceRef.current },
        withCredentials: true,
      });
      const fresh = data.orders || [];
      // Detect newly-arrived orders (by id) since last poll
      const arrivals = fresh.filter((o) => !seenIds.current.has(o.id));
      arrivals.forEach((o) => seenIds.current.add(o.id));
      // Merge orders: keep all, sort newest first, dedupe
      setOrders((prev) => {
        const byId = new Map();
        [...fresh, ...prev].forEach((o) => byId.set(o.id, o));
        return Array.from(byId.values())
          .filter((o) => o.status === "pending")
          .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      });
      if (arrivals.length > 0 && sinceRef.current !== new Date(0).toISOString()) {
        if (!muted) playChime();
        toast.success(`${arrivals.length} new order${arrivals.length > 1 ? "s" : ""}`, {
          description: arrivals.map((a) => a.order_number).join(", "),
        });
      }
      sinceRef.current = data.server_time || new Date().toISOString();
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNew();
    const t = setInterval(fetchNew, POLL_INTERVAL);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [muted]);

  const accept = async (id) => {
    try {
      await axios.post(`${API}/admin/orders/${id}/accept`, {}, { withCredentials: true });
      setOrders((list) => list.filter((o) => o.id !== id));
      toast.success("Order accepted");
    } catch { toast.error("Could not accept"); }
  };
  const reject = async (id) => {
    const reason = window.prompt("Reason for rejecting (optional):") || "";
    try {
      await axios.post(`${API}/admin/orders/${id}/reject`, { reason }, { withCredentials: true });
      setOrders((list) => list.filter((o) => o.id !== id));
      toast.success("Order rejected");
    } catch { toast.error("Could not reject"); }
  };

  return (
    <div data-testid="admin-new-orders-panel" className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-lg font-bold text-brand-text">Incoming orders</h2>
          {orders.length > 0 && (
            <span data-testid="new-orders-count" className="relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white font-body text-xs font-bold">
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60" />
              <span className="relative">{orders.length}</span>
            </span>
          )}
        </div>
        <button
          data-testid="mute-toggle-btn"
          onClick={toggleMute}
          aria-label={muted ? "Unmute alerts" : "Mute alerts"}
          className={`p-2 rounded-full border transition ${muted ? "border-brand-border text-brand-text-secondary bg-brand-bg" : "border-brand-primary text-brand-primary bg-brand-primary/10"}`}
        >
          {muted ? <BellOff size={14} /> : <Bell size={14} />}
        </button>
      </div>

      {loading ? (
        <div data-testid="new-orders-loading" className="py-6 flex justify-center"><div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : orders.length === 0 ? (
        <div data-testid="no-new-orders" className="py-8 text-center">
          <CheckCircle2 size={28} className="mx-auto text-green-500 mb-2" />
          <p className="font-body text-sm font-semibold text-brand-text">You're all caught up</p>
          <p className="font-body text-xs text-brand-text-secondary">New paid orders will appear here in real-time.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const Icon = fulfillmentIcon[o.fulfillment_type] || Clock;
            return (
              <div key={o.id} data-testid={`new-order-${o.order_number}`} className="p-4 rounded-xl border border-brand-border bg-brand-bg hover:border-brand-primary/40 transition">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={14} className="text-brand-primary flex-shrink-0" />
                      <span className="font-heading text-sm font-bold text-brand-text">{o.order_number}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary uppercase font-semibold tracking-wider">{(o.fulfillment_type || "").replace("_", "-")}</span>
                    </div>
                    <div className="font-body text-[11px] text-brand-text-secondary truncate">
                      {o.contact_name || o.contact_email} · {o.items?.length || 0} item{(o.items?.length || 0) > 1 ? "s" : ""} · ${(o.total || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    data-testid={`accept-order-${o.order_number}`}
                    onClick={() => accept(o.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-green-600 text-white font-body text-xs font-semibold rounded-lg hover:bg-green-700 transition active:scale-[0.98]"
                  >
                    <CheckCircle2 size={12} /> Accept
                  </button>
                  <button
                    data-testid={`reject-order-${o.order_number}`}
                    onClick={() => reject(o.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 border border-brand-border text-brand-text font-body text-xs font-semibold rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition active:scale-[0.98]"
                  >
                    <XCircle size={12} /> Reject
                  </button>
                  <Link
                    to={`/orders/track/${o.id}`}
                    data-testid={`view-order-${o.order_number}`}
                    className="inline-flex items-center justify-center py-2 px-3 border border-brand-border font-body text-xs font-semibold rounded-lg hover:border-brand-primary/40 text-brand-text-secondary hover:text-brand-primary transition"
                  >
                    View
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
