import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Bell, BellOff, Settings, RefreshCw, DollarSign, Clock, ShoppingBag,
  Loader2, Truck, Store, Utensils, Filter, CheckCircle2, Zap, Gauge, Pause,
} from "lucide-react";
import OrderCard from "@/components/queue/OrderCard";
import RejectDialog from "@/components/queue/RejectDialog";
import AudioSettingsModal, { loadQueueSettings, saveQueueSettings } from "@/components/queue/AudioSettingsModal";
import { playChime, playEscalation } from "@/utils/chime";

const API = "/api";
const POLL_MS = 5000;

const LANES = [
  { id: "incoming", label: "Incoming", tone: "red", statuses: ["pending"] },
  { id: "preparing", label: "Preparing", tone: "amber", statuses: ["preparing"] },
  { id: "ready", label: "Ready", tone: "green", statuses: ["ready"] },
  { id: "out_for_delivery", label: "En route", tone: "indigo", statuses: ["out_for_delivery"] },
  { id: "completed", label: "Completed", tone: "gray", statuses: ["completed", "delivered"] },
];

const TONE_HEADER = {
  red: "bg-red-50 border-red-200 text-red-700",
  amber: "bg-amber-50 border-amber-200 text-amber-700",
  green: "bg-green-50 border-green-200 text-green-700",
  indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
  gray: "bg-gray-50 border-gray-200 text-gray-600",
};

function SummaryStat({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 bg-white border border-brand-border rounded-lg">
      <div className="w-8 h-8 rounded-md bg-brand-primary/5 text-brand-primary flex items-center justify-center"><Icon size={14} /></div>
      <div>
        <div className="text-[9px] uppercase tracking-wider text-brand-text-secondary font-semibold">{label}</div>
        <div className="font-heading text-sm font-bold text-brand-text leading-tight">{value}</div>
      </div>
    </div>
  );
}

export default function AdminLiveQueue() {
  const [settings, setSettings] = useState(loadQueueSettings);
  const [showAudio, setShowAudio] = useState(false);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [rejecting, setRejecting] = useState(null); // {id, order_number}
  const seenIdsRef = useRef(new Set());
  const escalatedRef = useRef(new Set());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Filters
  const [fulfillFilter, setFulfillFilter] = useState("all");
  const [sortBy, setSortBy] = useState("placed_asc");
  const [throttle, setThrottle] = useState(null);

  const fetchQueue = useCallback(async (opts = {}) => {
    try {
      const { data } = await axios.get(`${API}/admin/queue/live`, { withCredentials: true });
      const fresh = data.orders || [];
      // Detect new incoming orders
      if (!opts.initial) {
        const nowSeen = new Set(seenIdsRef.current);
        const newIncoming = fresh.filter((o) => o.status === "pending" && !nowSeen.has(o.id));
        if (newIncoming.length > 0) {
          const s = settingsRef.current;
          if (!s.muted) playChime(s.chime, s.volume);
          if (s.desktop_notifications && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("New order!", {
                body: `${newIncoming.length} new ${newIncoming.length === 1 ? "order" : "orders"} — ${newIncoming[0].order_number}`,
                icon: "/favicon.ico",
                tag: "new-order",
              });
            } catch { /* ignore */ }
          }
        }
      }
      seenIdsRef.current = new Set(fresh.map((o) => o.id));
      setOrders(fresh);
      setSummary(data.summary || null);
      // Pull throttle status in parallel-ish (best effort)
      try {
        const { data: st } = await axios.get(`${API}/admin/throttle/status`, { withCredentials: true });
        setThrottle(st);
      } catch { /* ignore */ }
    } catch { /* swallow during poll */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchQueue({ initial: true });
    const t = setInterval(fetchQueue, POLL_MS);
    return () => clearInterval(t);
  }, [fetchQueue]);

  // Escalation checker
  useEffect(() => {
    const t = setInterval(() => {
      const s = settingsRef.current;
      if (s.muted) return;
      const threshold = s.escalation_seconds * 1000;
      for (const o of orders) {
        if (o.status !== "pending") continue;
        const waiting = Date.now() - new Date(o.created_at).getTime();
        if (waiting > threshold && !escalatedRef.current.has(o.id)) {
          escalatedRef.current.add(o.id);
          playEscalation(s.chime, Math.min(1, s.volume + 0.3));
        }
      }
      // Cleanup escalated set for orders no longer pending
      for (const id of Array.from(escalatedRef.current)) {
        const still = orders.find((o) => o.id === id && o.status === "pending");
        if (!still) escalatedRef.current.delete(id);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [orders]);

  const handleSettingsChange = (next) => {
    setSettings(next);
    saveQueueSettings(next);
    toast.success("Alert settings saved");
  };
  const toggleMute = () => {
    const next = { ...settings, muted: !settings.muted };
    setSettings(next); saveQueueSettings(next);
  };

  // Filter + sort
  const filtered = useMemo(() => {
    let list = orders;
    if (fulfillFilter !== "all") list = list.filter((o) => o.fulfillment_type === fulfillFilter);
    if (sortBy === "placed_asc") list = [...list].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    else if (sortBy === "placed_desc") list = [...list].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    else if (sortBy === "value_desc") list = [...list].sort((a, b) => (b.total || 0) - (a.total || 0));
    return list;
  }, [orders, fulfillFilter, sortBy]);

  const lanes = useMemo(() => {
    const byLane = Object.fromEntries(LANES.map((l) => [l.id, []]));
    for (const o of filtered) {
      const lane = LANES.find((l) => l.statuses.includes(o.status));
      if (lane) byLane[lane.id].push(o);
    }
    return byLane;
  }, [filtered]);

  const selectedCount = selected.size;
  const selectablePendingIds = useMemo(() => new Set(lanes.incoming.map((o) => o.id)), [lanes.incoming]);
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllIncoming = () => setSelected(new Set([...selectablePendingIds]));
  const clearSelection = () => setSelected(new Set());

  const accept = async (id) => {
    try {
      await axios.post(`${API}/admin/orders/${id}/accept`, {}, { withCredentials: true });
      toast.success("Order accepted");
      fetchQueue();
    } catch { toast.error("Could not accept"); }
  };
  const confirmReject = async (reason) => {
    if (!rejecting) return;
    try {
      await axios.post(`${API}/admin/orders/${rejecting.id}/reject`, { reason }, { withCredentials: true });
      toast.success("Order rejected");
      setRejecting(null);
      fetchQueue();
    } catch { toast.error("Could not reject"); }
  };
  const advance = async (id) => {
    try {
      await axios.post(`${API}/admin/orders/${id}/advance`, {}, { withCredentials: true });
      toast.success("Status updated");
      fetchQueue();
    } catch { toast.error("Could not update"); }
  };
  const reprint = (id) => {
    window.open(`/admin/ticket/${id}?type=kitchen&trigger=reprint&auto=1`, "_blank", "noopener,noreferrer");
  };

  const batchAccept = async () => {
    if (selectedCount === 0) return;
    try {
      const { data } = await axios.post(`${API}/admin/orders-batch/accept`, { order_ids: [...selected] }, { withCredentials: true });
      toast.success(`${data.accepted.length} accepted${data.skipped.length ? `, ${data.skipped.length} skipped` : ""}`);
      clearSelection();
      fetchQueue();
    } catch { toast.error("Batch accept failed"); }
  };

  return (
    <div data-testid="admin-live-queue-page" className="p-4 sm:p-6 lg:p-8 max-w-[1800px]">
      {/* Throttle banner */}
      {throttle && (
        <div
          data-testid="throttle-banner"
          data-state={throttle.state}
          className={`mb-3 flex items-center justify-between gap-3 px-4 py-2 rounded-lg border text-sm ${
            throttle.state === "paused" ? "bg-gray-100 border-gray-300 text-gray-700" :
            throttle.state === "at_capacity" ? "bg-red-50 border-red-200 text-red-700" :
            throttle.state === "busy" ? "bg-amber-50 border-amber-100 text-amber-800" :
            "bg-green-50 border-green-200 text-green-700"
          }`}
        >
          <span className="inline-flex items-center gap-2 font-semibold">
            {throttle.state === "paused" ? <Pause size={14} /> : <Gauge size={14} />}
            {throttle.state === "at_capacity" ? "At capacity — customers see scheduled slots"
              : throttle.state === "busy" ? "Busy — approaching capacity"
              : throttle.state === "paused" ? "Ordering paused — customers can't place new orders"
              : "Normal — accepting ASAP orders"}
          </span>
          <span className="text-xs font-mono">{throttle.active_count} / {throttle.max_concurrent_orders} · {Math.round((throttle.utilization || 0) * 100)}%</span>
        </div>
      )}
      {/* Pinned summary bar */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-brand-bg/90 backdrop-blur border-b border-brand-border mb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-heading text-2xl font-bold text-brand-text">Live Queue</h1>
            {summary && (
              <div className="flex items-center gap-2 flex-wrap" data-testid="queue-summary-bar">
                <SummaryStat label="Orders today" value={summary.orders_today} icon={ShoppingBag} />
                <SummaryStat label="Revenue" value={`$${summary.revenue_today.toFixed(2)}`} icon={DollarSign} />
                <SummaryStat label="Pending" value={summary.pending_count} icon={Zap} />
                <SummaryStat label="In progress" value={summary.in_progress_count} icon={Clock} />
                <SummaryStat label="Avg prep" value={`${summary.avg_prep_minutes}m`} icon={Clock} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="mute-btn"
              onClick={toggleMute}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition ${settings.muted ? "bg-brand-surface text-brand-text-secondary" : "bg-brand-primary/10 text-brand-primary"}`}
            >
              {settings.muted ? <><BellOff size={14} /> Muted</> : <><Bell size={14} /> Alerts on</>}
            </button>
            <button
              data-testid="audio-settings-btn"
              onClick={() => setShowAudio(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-brand-border text-xs font-semibold text-brand-text hover:border-brand-primary/40"
            >
              <Settings size={14} /> Alerts
            </button>
            <button
              data-testid="refresh-btn"
              onClick={() => fetchQueue()}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-brand-border text-brand-text-secondary hover:text-brand-primary"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mt-3 flex-wrap text-xs">
          <span className="inline-flex items-center gap-1 text-brand-text-secondary font-semibold"><Filter size={12} /> Filters:</span>
          <div className="inline-flex rounded-full border border-brand-border p-1 bg-white">
            {[
              { v: "all", label: "All", icon: null },
              { v: "delivery", label: "Delivery", icon: Truck },
              { v: "pickup", label: "Pick-up", icon: Store },
              { v: "dine_in", label: "Dine-in", icon: Utensils },
            ].map((f) => (
              <button
                key={f.v}
                data-testid={`filter-fulfill-${f.v}`}
                onClick={() => setFulfillFilter(f.v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full transition ${fulfillFilter === f.v ? "bg-brand-primary text-white font-semibold" : "text-brand-text-secondary"}`}
              >
                {f.icon ? <f.icon size={11} /> : null} {f.label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-full border border-brand-border p-1 bg-white">
            {[
              { v: "placed_asc", label: "Oldest first" },
              { v: "placed_desc", label: "Newest first" },
              { v: "value_desc", label: "Highest value" },
            ].map((s) => (
              <button
                key={s.v}
                data-testid={`sort-${s.v}`}
                onClick={() => setSortBy(s.v)}
                className={`px-2.5 py-1 rounded-full transition ${sortBy === s.v ? "bg-brand-primary text-white font-semibold" : "text-brand-text-secondary"}`}
              >{s.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Batch action bar */}
      {selectedCount > 0 && (
        <div data-testid="batch-bar" className="sticky top-[140px] z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-brand-primary text-white flex items-center justify-between mb-4 rounded-b-lg">
          <span className="font-body text-sm font-semibold">{selectedCount} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={selectAllIncoming} data-testid="select-all-incoming" className="text-xs font-semibold underline">Select all incoming ({lanes.incoming.length})</button>
            <button onClick={clearSelection} data-testid="clear-selection" className="text-xs underline">Clear</button>
            <button onClick={batchAccept} data-testid="batch-accept-btn" className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white text-brand-primary text-xs font-bold rounded-full hover:bg-brand-surface">
              <CheckCircle2 size={13} /> Accept {selectedCount}
            </button>
          </div>
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="py-20 flex justify-center"><Loader2 size={28} className="animate-spin text-brand-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {LANES.map((lane) => {
            const laneOrders = lanes[lane.id] || [];
            return (
              <div key={lane.id} data-testid={`lane-${lane.id}`} className="min-w-0">
                <div className={`sticky top-[190px] z-[5] border-2 rounded-t-xl px-3 py-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider ${TONE_HEADER[lane.tone]}`}>
                  <span className="inline-flex items-center gap-2">
                    {lane.id === "incoming" && laneOrders.length > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                    {lane.label}
                  </span>
                  <span className="text-[11px] font-semibold opacity-80">{laneOrders.length}</span>
                </div>
                <div className="space-y-2.5 pt-2.5">
                  {laneOrders.length === 0 ? (
                    <div className="text-xs text-brand-text-secondary italic text-center py-6 border border-dashed border-brand-border rounded-lg">
                      None
                    </div>
                  ) : laneOrders.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      lane={lane.id}
                      onAccept={accept}
                      onReject={(id) => setRejecting({ id, order_number: o.order_number })}
                      onAdvance={advance}
                      onReprint={reprint}
                      selectable={lane.id === "incoming"}
                      selected={selected.has(o.id)}
                      onToggleSelect={toggleSelect}
                      escalated={lane.id === "incoming" && escalatedRef.current.has(o.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AudioSettingsModal
        open={showAudio}
        onClose={() => setShowAudio(false)}
        settings={settings}
        onChange={handleSettingsChange}
      />
      <RejectDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={confirmReject}
        orderNumber={rejecting?.order_number}
      />
    </div>
  );
}
