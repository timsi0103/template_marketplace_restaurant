import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, Flag, CheckCircle2, MessageSquare, AlertTriangle, Trash2,
  Star as StarIcon, TrendingUp, Save, Settings, Shield, BadgeCheck, BarChart3,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import StarRating from "@/components/reviews/StarRating";

const API = "/api";

const TABS = [
  { key: "moderation", label: "Moderation", icon: Shield },
  { key: "insights", label: "Insights", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: Settings },
];

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs attention" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "flagged", label: "Flagged" },
];

export default function AdminReviews() {
  const [tab, setTab] = useState("moderation");

  return (
    <div data-testid="admin-reviews-page" className="p-6 lg:p-10 max-w-7xl">
      <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 data-testid="reviews-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">Ratings &amp; Reviews</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">Moderate customer feedback, respond to reviews, and track sentiment over time.</p>
        </div>
      </header>

      <div className="flex items-center gap-1 border-b border-brand-border mb-6">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              data-testid={`reviews-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-body font-semibold border-b-2 transition-colors ${active ? "border-brand-primary text-brand-primary" : "border-transparent text-brand-text-secondary hover:text-brand-text"}`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "moderation" && <ModerationTab />}
      {tab === "insights" && <InsightsTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

/* ──────────────────── Moderation ──────────────────── */

function ModerationTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("attention");
  const [respondTarget, setRespondTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/reviews`, {
        params: { status: statusFilter, limit: 200 },
        withCredentials: true,
      });
      setData(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't load reviews");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  async function approve(id) {
    try { await axios.post(`${API}/admin/reviews/${id}/approve`, {}, { withCredentials: true }); toast.success("Approved"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  }
  async function flag(id) {
    try { await axios.post(`${API}/admin/reviews/${id}/flag`, { reason: "Manual flag" }, { withCredentials: true }); toast.success("Flagged"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  }
  async function removeResponse(id) {
    try { await axios.delete(`${API}/admin/reviews/${id}/response`, { withCredentials: true }); toast.success("Response removed"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  }
  async function del(id) {
    if (!window.confirm("Delete this review permanently?")) return;
    try { await axios.delete(`${API}/admin/reviews/${id}`, { withCredentials: true }); toast.success("Deleted"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  }

  if (loading && !data) {
    return <div data-testid="moderation-loading" className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-brand-primary" /></div>;
  }
  if (!data) return null;

  const reviews = data.reviews || [];
  const counts = data.counts || {};

  return (
    <div>
      <div data-testid="moderation-filters" className="flex flex-wrap items-center gap-2 mb-5">
        {STATUS_FILTERS.map((f) => {
          const n = counts[f.key] ?? (f.key === "all" ? reviews.length : undefined);
          const active = statusFilter === f.key;
          return (
            <button
              key={f.key}
              data-testid={`moderation-filter-${f.key}`}
              onClick={() => setStatusFilter(f.key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-body font-semibold border transition-colors ${active ? "bg-brand-primary text-white border-brand-primary" : "bg-brand-surface text-brand-text border-brand-border hover:border-brand-primary/50"}`}
            >
              {f.label}{typeof n === "number" && <span className={`ml-0.5 text-[10px] ${active ? "opacity-80" : "text-brand-text-secondary"}`}>{n}</span>}
            </button>
          );
        })}
        <div className="flex-1" />
        <button data-testid="moderation-refresh-btn" onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-brand-border text-brand-text-secondary text-xs font-body font-medium rounded-full hover:bg-brand-surface">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {reviews.length === 0 ? (
        <div data-testid="moderation-empty" className="p-10 text-center text-sm font-body text-brand-text-secondary italic bg-brand-surface border border-brand-border rounded-2xl">
          Nothing here. {statusFilter === "attention" && "All low-rated reviews have a response — great job."}
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <article key={r.id} data-testid={`moderation-review-${r.id}`} className="p-4 bg-brand-surface border border-brand-border rounded-2xl">
              <header className="flex items-start justify-between gap-3 flex-wrap mb-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StarRating value={r.rating} size={14} readOnly testIdPrefix={`mod-stars-${r.id}`} />
                    <span className="font-body text-sm font-semibold text-brand-text">{r.user_name || "Customer"}</span>
                    <StatusBadge status={r.status} />
                    {r.verified_purchase && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full"><BadgeCheck size={10} /> Verified</span>}
                    {r.is_overall ? (
                      <span className="text-[10px] font-semibold text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded-full">Overall</span>
                    ) : r.item_name ? (
                      <span className="text-[10px] font-semibold text-brand-text-secondary bg-brand-bg px-1.5 py-0.5 rounded-full">{r.item_name}</span>
                    ) : null}
                    {r.rating <= 2 && !r.admin_response && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full"><AlertTriangle size={10} /> Needs response</span>
                    )}
                  </div>
                  <div className="text-[11px] text-brand-text-secondary mt-1 tabular-nums">
                    {new Date(r.created_at).toLocaleString()} · Order <span className="font-mono">{r.order_number}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {r.status !== "approved" && (
                    <button data-testid={`mod-approve-${r.id}`} onClick={() => approve(r.id)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200 hover:bg-emerald-100">
                      <CheckCircle2 size={11} /> Approve
                    </button>
                  )}
                  {r.status !== "flagged" && (
                    <button data-testid={`mod-flag-${r.id}`} onClick={() => flag(r.id)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold border border-amber-200 hover:bg-amber-100">
                      <Flag size={11} /> Flag
                    </button>
                  )}
                  <button data-testid={`mod-respond-${r.id}`} onClick={() => setRespondTarget(r)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-[11px] font-semibold border border-brand-primary/30 hover:bg-brand-primary/20">
                    <MessageSquare size={11} /> {r.admin_response ? "Edit reply" : "Respond"}
                  </button>
                  <button data-testid={`mod-delete-${r.id}`} onClick={() => del(r.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-red-600 text-[11px] font-semibold hover:bg-red-50">
                    <Trash2 size={11} />
                  </button>
                </div>
              </header>
              {r.text && (
                <p data-testid={`mod-text-${r.id}`} className="font-body text-sm text-brand-text leading-relaxed whitespace-pre-line">{r.text}</p>
              )}
              {r.photos?.length > 0 && (
                <div className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar">
                  {r.photos.map((p) => <img key={p.id} src={p.url} alt="" className="w-16 h-16 rounded-lg object-cover border border-brand-border" />)}
                </div>
              )}
              {r.admin_response && (
                <div className="mt-3 ml-6 pl-3 border-l-2 border-brand-primary/40 bg-brand-primary/5 rounded-r-lg py-2 pr-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare size={11} className="text-brand-primary" />
                      <span className="text-[10px] font-semibold text-brand-primary uppercase tracking-wider">Your response · {r.admin_response.responded_by}</span>
                    </div>
                    <button data-testid={`mod-delete-response-${r.id}`} onClick={() => removeResponse(r.id)} className="text-[10px] text-red-600 hover:underline">Remove</button>
                  </div>
                  <p className="font-body text-xs text-brand-text mt-1 whitespace-pre-line">{r.admin_response.text}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <RespondDialog target={respondTarget} onClose={() => setRespondTarget(null)} onSaved={() => { setRespondTarget(null); load(); }} />
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    approved: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    pending: { cls: "bg-amber-50 text-amber-700 border-amber-200" },
    flagged: { cls: "bg-red-50 text-red-700 border-red-200" },
    rejected: { cls: "bg-slate-100 text-slate-700 border-slate-200" },
  };
  const m = map[status] || map.pending;
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border uppercase tracking-wider ${m.cls}`}>{status}</span>;
}

function RespondDialog({ target, onClose, onSaved }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setText(target?.admin_response?.text || ""); }, [target]);

  async function save() {
    if (!text.trim()) { toast.error("Write something"); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/admin/reviews/${target.id}/respond`, { text }, { withCredentials: true });
      toast.success("Response posted");
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally { setSaving(false); }
  }

  if (!target) return null;
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="respond-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reply to {target.user_name || "the customer"}</DialogTitle>
          <DialogDescription>
            Your reply is shown publicly below the review.
          </DialogDescription>
        </DialogHeader>
        <div className="p-3 bg-brand-bg/50 rounded-lg border border-brand-border">
          <StarRating value={target.rating} size={12} readOnly />
          <p className="text-xs text-brand-text mt-1 whitespace-pre-line">{target.text || <em className="text-brand-text-secondary">No text left.</em>}</p>
        </div>
        <Textarea
          data-testid="respond-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Thanks for your feedback! We…"
          className="min-h-[120px] bg-brand-bg"
          maxLength={1200}
        />
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-brand-text-secondary">Cancel</button>
          <button data-testid="respond-save-btn" disabled={saving} onClick={save} className="px-5 py-2 rounded-full bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover disabled:opacity-50">
            {saving ? "Posting…" : "Post response"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────────────── Insights ──────────────────── */

function InsightsTab() {
  const [agg, setAgg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  async function load() {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/reviews/aggregate`, {
        params: { days }, withCredentials: true,
      });
      setAgg(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't load insights");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  const distRows = useMemo(() => {
    if (!agg) return [];
    const max = Math.max(1, ...Object.values(agg.distribution || {}));
    return [5, 4, 3, 2, 1].map((n) => ({
      n, count: agg.distribution[String(n)] || 0,
      pct: ((agg.distribution[String(n)] || 0) / (agg.approved || 1)) * 100,
      maxPct: ((agg.distribution[String(n)] || 0) / max) * 100,
    }));
  }, [agg]);

  if (loading && !agg) return <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-brand-primary" /></div>;
  if (!agg) return null;

  return (
    <div data-testid="insights-tab" className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 bg-brand-surface border border-brand-border rounded-full p-1">
          {[7, 30, 90, 365].map((d) => (
            <button
              key={d}
              data-testid={`insights-days-${d}`}
              onClick={() => setDays(d)}
              className={`px-3.5 py-1 rounded-full text-xs font-body font-semibold transition-colors ${days === d ? "bg-brand-primary text-white" : "text-brand-text-secondary hover:text-brand-text"}`}
            >
              {d === 365 ? "1 year" : `${d} days`}
            </button>
          ))}
        </div>
        <button data-testid="insights-refresh-btn" onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-brand-border text-brand-text-secondary text-xs font-body font-medium rounded-full hover:bg-brand-surface">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Average rating" value={Number(agg.average_rating || 0).toFixed(2)} icon={StarIcon} hint={`${agg.approved} approved`} />
        <KPI label="Total reviews" value={agg.total_reviews} icon={MessageSquare} />
        <KPI label="Response rate" value={`${agg.response_rate}%`} icon={TrendingUp} hint="On 1★ & 2★ reviews" />
        <KPI label="Needs attention" value={agg.attention_count} icon={AlertTriangle} accent={agg.attention_count > 0 ? "warn" : undefined} hint="1★/2★ unresponded" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-brand-surface border border-brand-border rounded-2xl p-5">
          <h2 className="font-heading text-base font-bold text-brand-text mb-4">Rating distribution</h2>
          <div className="space-y-2">
            {distRows.map((r) => (
              <div key={r.n} data-testid={`insights-dist-${r.n}`} className="flex items-center gap-3">
                <span className="w-10 text-xs font-body font-semibold text-brand-text inline-flex items-center gap-0.5">{r.n} <StarIcon size={10} className="fill-amber-400 text-amber-400" /></span>
                <div className="flex-1 h-2.5 rounded-full bg-brand-bg overflow-hidden">
                  <div className="h-full bg-amber-400" style={{ width: `${r.maxPct}%` }} />
                </div>
                <span className="w-24 text-right text-xs text-brand-text-secondary tabular-nums">{r.count.toLocaleString()} · {r.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-brand-surface border border-brand-border rounded-2xl p-5">
          <h2 className="font-heading text-base font-bold text-brand-text mb-4">Trend · last {days} days</h2>
          {agg.trend.length === 0 ? (
            <div className="text-sm text-brand-text-secondary italic">Not enough data yet.</div>
          ) : (
            <TrendChart trend={agg.trend} />
          )}
        </section>
      </div>
    </div>
  );
}

function KPI({ label, value, icon: Icon, hint, accent }) {
  const accentCls = accent === "warn" ? "text-amber-600" : "text-brand-text";
  return (
    <div className="bg-brand-surface border border-brand-border rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-brand-text-secondary font-semibold">
        {Icon && <Icon size={11} />} {label}
      </div>
      <div className={`font-heading text-3xl font-bold mt-1.5 ${accentCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-brand-text-secondary mt-0.5">{hint}</div>}
    </div>
  );
}

function TrendChart({ trend }) {
  const maxAvg = 5;
  const w = 360;
  const h = 140;
  const n = trend.length;
  const stepX = n > 1 ? (w - 30) / (n - 1) : w;
  const points = trend.map((t, i) => {
    const x = 15 + i * stepX;
    const y = h - 20 - (t.avg / maxAvg) * (h - 40);
    return { x, y, day: t.day, avg: t.avg, count: t.count };
  });
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[320px] h-auto">
        {/* gridlines */}
        {[1, 2, 3, 4, 5].map((g) => {
          const y = h - 20 - (g / maxAvg) * (h - 40);
          return <line key={g} x1={10} x2={w - 5} y1={y} y2={y} stroke="currentColor" className="text-brand-border" strokeWidth="0.5" />;
        })}
        <path d={pathD} fill="none" strokeWidth="2" stroke="currentColor" className="text-brand-primary" />
        {points.map((p) => (
          <g key={p.day}>
            <circle cx={p.x} cy={p.y} r="3" className="fill-brand-primary" />
            <title>{`${p.day}: ${p.avg.toFixed(2)} avg · ${p.count} reviews`}</title>
          </g>
        ))}
        {/* y labels */}
        {[1, 3, 5].map((g) => {
          const y = h - 20 - (g / maxAvg) * (h - 40);
          return <text key={g} x={0} y={y + 3} fontSize="9" className="fill-brand-text-secondary">{g}★</text>;
        })}
      </svg>
    </div>
  );
}

/* ──────────────────── Settings ──────────────────── */

function SettingsTab() {
  const [config, setConfig] = useState(null);
  const [original, setOriginal] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const { data } = await axios.get(`${API}/admin/review-config`, { withCredentials: true });
      setConfig(data);
      setOriginal(JSON.parse(JSON.stringify(data)));
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed to load"); }
  }
  useEffect(() => { load(); }, []);

  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(original), [config, original]);

  function toggleFulfillment(t) {
    const list = new Set(config.enabled_fulfillment_types || []);
    if (list.has(t)) list.delete(t); else list.add(t);
    setConfig({ ...config, enabled_fulfillment_types: Array.from(list) });
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        enabled: config.enabled,
        auto_send_delay_minutes: Number(config.auto_send_delay_minutes),
        message_template: config.message_template,
        enabled_fulfillment_types: config.enabled_fulfillment_types,
        auto_approve: config.auto_approve,
        allow_photos: config.allow_photos,
        allow_anonymous: config.allow_anonymous,
      };
      await axios.patch(`${API}/admin/review-config`, body, { withCredentials: true });
      toast.success("Settings saved");
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  }

  if (!config) return <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-brand-primary" /></div>;

  return (
    <div data-testid="settings-tab" className="max-w-3xl space-y-5">
      <section className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="font-heading text-base font-bold text-brand-text">Review request automation</h2>
        <ToggleRow
          title="Enable automatic review requests"
          subtitle="When on, customers see a prompt on their order page after fulfillment."
          checked={config.enabled}
          onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
          testId="settings-enabled-switch"
        />
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Delay after delivery / pickup (minutes)</Label>
          <Input
            data-testid="settings-delay-input"
            type="number"
            min={0}
            max={10080}
            value={config.auto_send_delay_minutes}
            onChange={(e) => setConfig({ ...config, auto_send_delay_minutes: e.target.value })}
            className="mt-1.5 h-10 text-sm max-w-40 bg-brand-bg border-brand-border"
          />
          <p className="text-[11px] text-brand-text-secondary mt-1">Default: 60 minutes. Use 0 to prompt immediately.</p>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Message template</Label>
          <Textarea
            data-testid="settings-template-input"
            value={config.message_template}
            onChange={(e) => setConfig({ ...config, message_template: e.target.value })}
            maxLength={400}
            className="mt-1.5 min-h-[80px] text-sm bg-brand-bg border-brand-border"
          />
          <div className="text-[10px] text-brand-text-secondary text-right mt-0.5">{(config.message_template || "").length}/400</div>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Enabled for order types</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {[["delivery", "Delivery"], ["pickup", "Pickup"], ["dine_in", "Dine-in"]].map(([k, lbl]) => {
              const on = config.enabled_fulfillment_types?.includes(k);
              return (
                <button
                  key={k}
                  data-testid={`settings-ft-${k}`}
                  onClick={() => toggleFulfillment(k)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-body font-semibold border transition-colors ${on ? "bg-brand-primary text-white border-brand-primary" : "bg-brand-surface text-brand-text border-brand-border hover:border-brand-primary/40"}`}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="font-heading text-base font-bold text-brand-text">Submission &amp; moderation</h2>
        <ToggleRow
          title="Auto-approve new reviews"
          subtitle="If off, reviews enter the Pending queue for manual approval before being visible."
          checked={config.auto_approve}
          onCheckedChange={(v) => setConfig({ ...config, auto_approve: v })}
          testId="settings-autoapprove-switch"
        />
        <ToggleRow
          title="Allow photo uploads"
          subtitle="Customers can attach up to 5 photos per review."
          checked={config.allow_photos}
          onCheckedChange={(v) => setConfig({ ...config, allow_photos: v })}
          testId="settings-photos-switch"
        />
        <ToggleRow
          title="Allow anonymous reviews"
          subtitle="Customers can choose not to display their name publicly."
          checked={config.allow_anonymous}
          onCheckedChange={(v) => setConfig({ ...config, allow_anonymous: v })}
          testId="settings-anonymous-switch"
        />
      </section>

      <button
        data-testid="settings-save-btn"
        disabled={saving || !dirty}
        onClick={save}
        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-brand-primary text-white text-sm font-body font-semibold hover:bg-brand-primary-hover disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {dirty ? "Save settings" : "Saved"}
      </button>
    </div>
  );
}

function ToggleRow({ title, subtitle, checked, onCheckedChange, testId }) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-brand-border bg-brand-bg">
      <div>
        <div className="font-body text-sm font-semibold text-brand-text">{title}</div>
        <div className="text-[11px] text-brand-text-secondary mt-0.5">{subtitle}</div>
      </div>
      <Switch data-testid={testId} checked={!!checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
