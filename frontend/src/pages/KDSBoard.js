import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Bell, BellOff, Settings2, Columns2, Columns3, Columns4, Loader2,
  Clock, Truck, Store, Utensils, CheckCircle2, Play, ChefHat, ArrowLeft, X,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const API = "/api";
const POLL_INTERVAL = 5000;

const FULFILL_META = {
  delivery: { label: "Delivery", icon: Truck, bg: "bg-blue-500" },
  pickup: { label: "Takeout", icon: Store, bg: "bg-orange-500" },
  dine_in: { label: "Dine-in", icon: Utensils, bg: "bg-green-500" },
};

const ITEM_STATUS_META = {
  pending: { label: "Start", next: "started", icon: Play, btn: "bg-brand-primary/10 text-brand-primary border-brand-primary/30 hover:bg-brand-primary/20" },
  started: { label: "Ready", next: "ready", icon: CheckCircle2, btn: "bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/20" },
  ready: { label: "Ready ✓", next: "pending", icon: CheckCircle2, btn: "bg-green-500/10 text-green-700 border-green-500/30" },
};

function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [1046, 784, 1046].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = now + i * 0.16;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.linearRampToValueAtTime(0, start + 0.14);
      osc.start(start);
      osc.stop(start + 0.16);
    });
    setTimeout(() => ctx.close && ctx.close(), 700);
  } catch { /* noop */ }
}

function elapsedMinutes(order) {
  const start = order.accepted_at || order.created_at;
  if (!start) return 0;
  return Math.max(0, Math.floor((Date.now() - Date.parse(start)) / 60000));
}
function elapsedSeconds(order) {
  const start = order.accepted_at || order.created_at;
  if (!start) return 0;
  return Math.max(0, Math.floor((Date.now() - Date.parse(start)) / 1000));
}

function urgency(order, settings) {
  const cats = (order.items || []).map((it) => (it.category || "").toLowerCase()).filter(Boolean);
  const prepMap = settings?.target_prep_minutes_by_category || {};
  const target = cats.length
    ? Math.max(...cats.map((c) => prepMap[c] || 15))
    : 15;
  const elapsed = elapsedMinutes(order);
  const pct = elapsed / target;
  if (pct >= 1) return "red";
  if (pct >= 0.8) return "yellow";
  return "green";
}

const URGENCY_CLASSES = {
  green: "border-green-300 bg-white",
  yellow: "border-amber-400 bg-amber-50 ring-2 ring-amber-400/30",
  red: "border-red-500 bg-red-50 ring-4 ring-red-500/30 animate-pulse",
};
const URGENCY_ACCENT = {
  green: "bg-green-500",
  yellow: "bg-amber-500",
  red: "bg-red-600",
};

export default function KDSBoard() {
  const { user } = useAuth();
  const { station } = useParams();
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState(3);
  const [muted, setMuted] = useState(() => localStorage.getItem("kds_muted") === "1");
  const [tick, setTick] = useState(0);
  const seenIds = useRef(new Set());
  const initialLoad = useRef(true);

  // 1-second tick for elapsed timer
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchBoard = async () => {
    try {
      const { data } = await axios.get(`${API}/admin/kds/board`, {
        params: station ? { station } : {},
        withCredentials: true,
      });
      const newOrders = data.orders || [];
      const arrivals = newOrders.filter((o) => !seenIds.current.has(o.id));
      newOrders.forEach((o) => seenIds.current.add(o.id));
      setOrders(newOrders);
      setSettings(data.settings);
      if (initialLoad.current) {
        setColumns(data.settings?.default_columns || 3);
        initialLoad.current = false;
      } else if (arrivals.length > 0) {
        if (!muted && data.settings?.audio_enabled !== false) playChime();
        toast.success(`${arrivals.length} new order${arrivals.length > 1 ? "s" : ""}`, {
          description: arrivals.map((a) => a.order_number).join(", "),
        });
      }
    } catch (e) { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchBoard();
    const t = setInterval(fetchBoard, POLL_INTERVAL);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [station, muted]);

  const setItemStatus = async (orderId, lineIndex, nextStatus) => {
    try {
      const { data } = await axios.patch(
        `${API}/admin/kds/orders/${orderId}/items/${lineIndex}`,
        { status: nextStatus },
        { withCredentials: true },
      );
      setOrders((list) => list.map((o) => o.id === orderId ? data : o));
    } catch { toast.error("Could not update item"); }
  };

  const bumpOrder = async (orderId, orderNumber) => {
    try {
      await axios.post(`${API}/admin/kds/orders/${orderId}/bump`, {}, { withCredentials: true });
      setOrders((list) => list.filter((o) => o.id !== orderId));
      seenIds.current.delete(orderId);
      toast.success(`${orderNumber} bumped`);
    } catch { toast.error("Could not bump order"); }
  };

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem("kds_muted", next ? "1" : "0");
      return next;
    });
  };

  const sorted = useMemo(() => [...orders].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")), [orders]);

  // Guard
  if (!user || !user.role || (user.role !== "admin" && user.role !== "staff")) {
    return (
      <div data-testid="kds-unauth" className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <ChefHat size={48} className="mx-auto mb-3 text-brand-primary" />
          <p className="font-body text-sm mb-3">Admin access required</p>
          <Link to="/login" className="text-brand-primary underline text-sm">Sign in</Link>
        </div>
      </div>
    );
  }

  const stations = Object.keys(settings?.station_routing || {});
  void tick; // ensure rerenders happen (used implicitly)

  return (
    <div data-testid="kds-board" className="fixed inset-0 z-[60] bg-[#0B0B0B] text-white overflow-hidden flex flex-col">
      {/* Top bar */}
      <header className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/10 bg-black/50 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/admin" data-testid="kds-exit-btn" className="p-2 rounded-full hover:bg-white/10" aria-label="Exit KDS">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <ChefHat size={18} className="text-brand-primary" />
            <span className="font-heading text-lg font-bold tracking-tight truncate">Kitchen Display</span>
            {station && (
              <span data-testid={`kds-station-${station}`} className="ml-1 px-2 py-0.5 rounded-full bg-brand-primary/30 border border-brand-primary/40 font-body text-[10px] uppercase tracking-widest font-semibold">
                {station}
              </span>
            )}
          </div>
        </div>

        <nav data-testid="kds-station-nav" className="hidden md:flex items-center gap-1 overflow-x-auto">
          <StationBtn to="/kds" active={!station}>All</StationBtn>
          {stations.map((s) => (
            <StationBtn key={s} to={`/kds/${s}`} active={station === s} dataTestId={`kds-nav-${s}`}>{s}</StationBtn>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 border border-white/20 rounded-full px-1 py-0.5" data-testid="kds-layout-switch">
            {[2, 3, 4].map((n) => {
              const Icon = n === 2 ? Columns2 : n === 3 ? Columns3 : Columns4;
              return (
                <button
                  key={n}
                  data-testid={`kds-cols-${n}`}
                  onClick={() => setColumns(n)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition ${columns === n ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>
          <button
            data-testid="kds-mute-btn"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            className={`w-9 h-9 rounded-full flex items-center justify-center border ${muted ? "border-white/20 text-white/50" : "border-brand-primary/50 text-brand-primary bg-brand-primary/10"}`}
          >
            {muted ? <BellOff size={14} /> : <Bell size={14} />}
          </button>
          <Link
            to="/admin/kds-settings"
            data-testid="kds-settings-link"
            className="w-9 h-9 rounded-full flex items-center justify-center border border-white/20 hover:bg-white/10"
            aria-label="Settings"
          >
            <Settings2 size={14} />
          </Link>
        </div>
      </header>

      {/* Board */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        {loading && (
          <div className="py-20 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-brand-primary" />
          </div>
        )}
        {!loading && sorted.length === 0 && (
          <div data-testid="kds-empty" className="h-full flex items-center justify-center text-center">
            <div>
              <CheckCircle2 size={56} className="mx-auto text-green-400 mb-3" />
              <h2 className="font-heading text-2xl font-bold">All caught up</h2>
              <p className="font-body text-sm text-white/60 mt-1">Paid orders will appear here in real-time.</p>
              <p className="font-body text-[11px] text-white/40 mt-4">Polling every {POLL_INTERVAL / 1000}s.</p>
            </div>
          </div>
        )}
        {!loading && sorted.length > 0 && (
          <div
            data-testid="kds-grid"
            className={`grid gap-3 ${columns === 2 ? "grid-cols-1 md:grid-cols-2" : columns === 4 ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}
          >
            {sorted.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                settings={settings}
                onItemStatus={setItemStatus}
                onBump={() => bumpOrder(o.id, o.order_number)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StationBtn({ to, active, children, dataTestId }) {
  return (
    <Link
      to={to}
      data-testid={dataTestId}
      className={`px-3 py-1.5 rounded-full text-xs font-body font-semibold uppercase tracking-wider transition ${active ? "bg-white text-black" : "text-white/60 hover:text-white hover:bg-white/10"}`}
    >
      {children}
    </Link>
  );
}

function OrderCard({ order, settings, onItemStatus, onBump }) {
  const u = urgency(order, settings);
  const ful = FULFILL_META[order.fulfillment_type] || FULFILL_META.pickup;
  const FulIcon = ful.icon;
  const secs = elapsedSeconds(order);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const allReady = (order.items || []).every((it) => it.kds_status === "ready");

  return (
    <div
      data-testid={`kds-card-${order.order_number}`}
      data-urgency={u}
      className={`relative rounded-xl border-2 text-[#1a1a1a] overflow-hidden transition-all ${URGENCY_CLASSES[u]}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${URGENCY_ACCENT[u]}`} />

      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-heading text-lg font-bold text-[#1a1a1a] truncate">{order.order_number}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[10px] font-body font-semibold uppercase tracking-wider ${ful.bg}`}>
              <FulIcon size={10} /> {ful.label}
            </span>
          </div>
          <div className="font-body text-xs text-[#4a4a4a] truncate">
            {order.fulfillment_type === "dine_in" ? `Table ${order.table_number}` : order.contact_name || order.contact_email}
          </div>
        </div>
        <div data-testid={`kds-timer-${order.order_number}`} className="text-right flex-shrink-0">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/5">
            <Clock size={11} />
            <span className="font-mono font-bold text-sm">{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</span>
          </div>
        </div>
      </div>

      {/* Items */}
      <ul className="px-4 py-2 space-y-1.5 bg-white/60">
        {(order.items || []).map((it, idx) => {
          const lineIdx = it._line_index != null ? it._line_index : idx;
          const status = it.kds_status || "pending";
          const meta = ITEM_STATUS_META[status] || ITEM_STATUS_META.pending;
          const StatusIcon = meta.icon;
          const lineKey = `${order.id}-${lineIdx}`;
          return (
            <li key={lineKey} data-testid={`kds-item-${order.order_number}-${lineIdx}`} className="flex items-start gap-2">
              <button
                data-testid={`kds-item-status-${order.order_number}-${lineIdx}`}
                onClick={() => onItemStatus(order.id, lineIdx, meta.next)}
                className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border font-body text-[10px] font-bold uppercase tracking-wider transition ${meta.btn}`}
              >
                <StatusIcon size={10} /> {meta.label}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`font-heading text-sm font-bold ${status === "ready" ? "line-through opacity-60" : ""}`}>
                    {it.qty}× {it.name}
                  </span>
                  {it.category && <span className="text-[9px] uppercase tracking-widest text-[#8a8a8a] flex-shrink-0">{it.category}</span>}
                </div>
                {it.variant_name && <div className="font-body text-[11px] text-brand-primary font-semibold">{it.variant_name}</div>}
                {it.modifiers?.length > 0 && (
                  <ul className="mt-0.5">
                    {it.modifiers.map((m, i) => (
                      <li key={i} className="font-body text-[11px] text-[#555] flex items-start gap-1">
                        <span className="text-brand-primary">+</span>
                        <span>{m.group}: <strong>{m.name}</strong></span>
                      </li>
                    ))}
                  </ul>
                )}
                {it.instructions && (
                  <div className="mt-1 px-2 py-1 rounded bg-amber-100 text-amber-900 font-body text-[11px] italic">
                    📝 {it.instructions}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-black/10 flex items-center justify-between gap-2 bg-black/5">
        <div className="font-body text-[11px] text-[#6a6a6a]">
          {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? "s" : ""}{order.scheduled_slot && order.scheduled_slot !== "ASAP" ? ` · ${order.scheduled_slot}` : ""}
        </div>
        <button
          data-testid={`kds-bump-${order.order_number}`}
          onClick={onBump}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-body text-xs font-bold uppercase tracking-wider transition active:scale-[0.97] ${allReady ? "bg-green-600 text-white hover:bg-green-700" : "bg-black text-white hover:bg-black/80"}`}
        >
          <CheckCircle2 size={12} /> Bump
        </button>
      </div>
    </div>
  );
}
