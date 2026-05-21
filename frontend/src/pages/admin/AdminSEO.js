import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Save, Globe, Search as SearchIcon, Share2, Braces, ArrowRight, Trash2, Plus, RotateCcw, Copy, ExternalLink, Download, ShieldCheck, Heart, FileCode, ListTree } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API = "/api";

export default function AdminSEO() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null); // { global, pages, available_structured_types }
  const [activePageKey, setActivePageKey] = useState("home");
  const [pageOriginal, setPageOriginal] = useState(null);
  const [pageDraft, setPageDraft] = useState(null);
  const [globalDraft, setGlobalDraft] = useState(null);
  const [globalOriginal, setGlobalOriginal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [redirects, setRedirects] = useState([]);
  const [health, setHealth] = useState(null);
  const [sitemapPreview, setSitemapPreview] = useState(null);
  const [robotsPreview, setRobotsPreview] = useState("");
  const [livePreview, setLivePreview] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r, h] = await Promise.all([
        axios.get(`${API}/admin/seo/settings`, { withCredentials: true }),
        axios.get(`${API}/admin/seo/redirects`, { withCredentials: true }),
        axios.get(`${API}/admin/seo/health`, { withCredentials: true }),
      ]);
      setData(s.data);
      setGlobalDraft(JSON.parse(JSON.stringify(s.data.global)));
      setGlobalOriginal(JSON.parse(JSON.stringify(s.data.global)));
      // pageDraft initialization happens in the activePageKey-driven effect below
      setRedirects(r.data.redirects || []);
      setHealth(h.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to load SEO data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // When page key changes, reload drafts from full data
  useEffect(() => {
    if (!data) return;
    const p = data.pages.find((x) => x.page_key === activePageKey) || data.pages[0];
    setPageDraft(JSON.parse(JSON.stringify(p)));
    setPageOriginal(JSON.parse(JSON.stringify(p)));
  }, [activePageKey, data]);

  // Debounced live preview for current page draft
  useEffect(() => {
    if (!pageDraft) return;
    const t = setTimeout(async () => {
      try {
        const { data: d } = await axios.get(`${API}/seo/page/${pageDraft.page_key}`);
        setLivePreview(d);
      } catch (err) { console.warn("SEO live preview fetch failed:", err?.message || err); }
    }, 300);
    return () => clearTimeout(t);
    // Intentionally watch only page_key — preview should not refire on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageDraft?.page_key]);

  const pageDirty = useMemo(() => JSON.stringify(pageDraft) !== JSON.stringify(pageOriginal), [pageDraft, pageOriginal]);
  const globalDirty = useMemo(() => JSON.stringify(globalDraft) !== JSON.stringify(globalOriginal), [globalDraft, globalOriginal]);

  async function savePage() {
    if (!pageDraft) return;
    setSaving(true);
    try {
      const payload = {
        title: pageDraft.title || "",
        description: pageDraft.description || "",
        keywords: pageDraft.keywords || [],
        og_title: pageDraft.og_title || "",
        og_description: pageDraft.og_description || "",
        og_image_url: pageDraft.og_image_url || "",
        canonical_url: pageDraft.canonical_url || "",
        noindex: !!pageDraft.noindex,
        nofollow: !!pageDraft.nofollow,
        twitter_card: pageDraft.twitter_card || "summary_large_image",
        structured_data_types: pageDraft.structured_data_types || [],
      };
      await axios.patch(`${API}/admin/seo/pages/${pageDraft.page_key}`, payload, { withCredentials: true });
      toast.success("Page SEO saved");
      await loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveGlobal() {
    setSaving(true);
    try {
      const g = globalDraft;
      const payload = {
        default_title_suffix: g.default_title_suffix,
        default_description: g.default_description,
        default_og_image_url: g.default_og_image_url,
        site_url: g.site_url,
        google_verification: g.google_verification,
        bing_verification: g.bing_verification,
        facebook_app_id: g.facebook_app_id,
        twitter_handle: g.twitter_handle,
        organization: g.organization,
        robots: g.robots,
        sitemap: g.sitemap,
      };
      await axios.patch(`${API}/admin/seo/settings`, payload, { withCredentials: true });
      toast.success("Global SEO saved");
      await loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  }

  async function refreshSitemap() {
    try {
      const { data: d } = await axios.get(`${API}/admin/seo/sitemap-preview`, { withCredentials: true });
      setSitemapPreview(d);
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed to fetch sitemap"); }
  }
  async function refreshRobots() {
    try {
      const { data: d } = await axios.get(`${API}/admin/seo/robots-preview`, { withCredentials: true });
      setRobotsPreview(d.content || "");
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed to fetch robots"); }
  }

  if (loading || !data || !pageDraft) {
    return <div data-testid="seo-loading" className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-brand-primary" /></div>;
  }

  return (
    <div data-testid="admin-seo-page" className="p-6 lg:p-10 max-w-[1400px]">
      <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 data-testid="seo-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">SEO &amp; Structured Data</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">Per-page meta, social previews, schema.org markup, sitemap, redirects, and health.</p>
        </div>
        {health && <HealthScoreBadge score={health.score} summary={health.summary} />}
      </header>

      <Tabs defaultValue="pages" className="w-full">
        <TabsList data-testid="seo-tablist" className="bg-brand-surface border border-brand-border rounded-full p-1 inline-flex">
          <TabsTrigger data-testid="seo-tab-pages" value="pages" className="rounded-full px-4 text-sm">Per-Page</TabsTrigger>
          <TabsTrigger data-testid="seo-tab-structured" value="structured" className="rounded-full px-4 text-sm">Structured Data</TabsTrigger>
          <TabsTrigger data-testid="seo-tab-global" value="global" className="rounded-full px-4 text-sm">Global</TabsTrigger>
          <TabsTrigger data-testid="seo-tab-redirects" value="redirects" className="rounded-full px-4 text-sm">Redirects</TabsTrigger>
          <TabsTrigger data-testid="seo-tab-sitemap" value="sitemap" className="rounded-full px-4 text-sm">Sitemap &amp; Robots</TabsTrigger>
          <TabsTrigger data-testid="seo-tab-health" value="health" className="rounded-full px-4 text-sm">Health</TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="mt-6">
          <PerPageTab
            pages={data.pages}
            activePageKey={activePageKey}
            setActivePageKey={setActivePageKey}
            pageDraft={pageDraft}
            setPageDraft={setPageDraft}
            pageDirty={pageDirty}
            saving={saving}
            save={savePage}
            discard={() => setPageDraft(JSON.parse(JSON.stringify(pageOriginal)))}
            livePreview={livePreview}
            globalDraft={globalDraft}
          />
        </TabsContent>

        <TabsContent value="structured" className="mt-6">
          <StructuredDataTab
            pageDraft={pageDraft}
            setPageDraft={setPageDraft}
            pages={data.pages}
            activePageKey={activePageKey}
            setActivePageKey={setActivePageKey}
            available={data.available_structured_types}
            pageDirty={pageDirty}
            saving={saving}
            save={savePage}
            livePreview={livePreview}
          />
        </TabsContent>

        <TabsContent value="global" className="mt-6">
          <GlobalTab
            globalDraft={globalDraft}
            setGlobalDraft={setGlobalDraft}
            globalDirty={globalDirty}
            saving={saving}
            save={saveGlobal}
            discard={() => setGlobalDraft(JSON.parse(JSON.stringify(globalOriginal)))}
          />
        </TabsContent>

        <TabsContent value="redirects" className="mt-6">
          <RedirectsTab redirects={redirects} refresh={async () => {
            const r = await axios.get(`${API}/admin/seo/redirects`, { withCredentials: true });
            setRedirects(r.data.redirects || []);
          }} />
        </TabsContent>

        <TabsContent value="sitemap" className="mt-6">
          <SitemapRobotsTab
            sitemapPreview={sitemapPreview}
            refreshSitemap={refreshSitemap}
            robotsPreview={robotsPreview}
            refreshRobots={refreshRobots}
            siteUrl={globalDraft.site_url}
          />
        </TabsContent>

        <TabsContent value="health" className="mt-6">
          <HealthTab health={health} refresh={loadAll} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Per-Page Tab ──────────────────────────────────────────────

function PerPageTab({ pages, activePageKey, setActivePageKey, pageDraft, setPageDraft, pageDirty, saving, save, discard, livePreview, globalDraft }) {
  const siteUrl = (globalDraft?.site_url || window.location.origin).replace(/\/$/, "");
  const fullUrl = `${siteUrl}${(livePreview?.path || pageDraft.path || "/")}`;
  const effectiveTitle = pageDraft.title || livePreview?.meta?.title || "";
  const effectiveDesc = pageDraft.description || livePreview?.meta?.description || "";
  const effectiveImg = pageDraft.og_image_url || livePreview?.meta?.og_image_url || "";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_420px] gap-6">
      {/* Left: page list */}
      <aside data-testid="seo-page-list" className="bg-brand-surface border border-brand-border rounded-2xl p-3 h-fit sticky top-6 self-start">
        <div className="px-2 pb-2 font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Pages</div>
        <div className="flex flex-col gap-0.5">
          {pages.map((p) => {
            const active = p.page_key === activePageKey;
            return (
              <button
                key={p.page_key}
                data-testid={`seo-page-btn-${p.page_key}`}
                onClick={() => setActivePageKey(p.page_key)}
                className={`text-left px-3 py-2 rounded-lg text-sm font-body flex items-center justify-between ${active ? "bg-brand-primary text-white" : "text-brand-text hover:bg-brand-bg"}`}
              >
                <span>{p.label}</span>
                {p.noindex && <span className={`text-[10px] uppercase ${active ? "text-white/70" : "text-orange-600"}`}>noindex</span>}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Center: editor */}
      <section className="space-y-5">
        <EditorCard title="Meta tags" subtitle="Title appears in browser tabs & search results. Description drives click-through." icon={SearchIcon}>
          <LabeledInput
            label="Title"
            testId="seo-title-input"
            counterMax={60}
            value={pageDraft.title || ""}
            onChange={(v) => setPageDraft({ ...pageDraft, title: v })}
            placeholder="e.g. Seasonal pasta, baked daily — The Culinary Editorial"
          />
          <LabeledTextarea
            label="Description"
            testId="seo-desc-input"
            counterMax={160}
            value={pageDraft.description || ""}
            onChange={(v) => setPageDraft({ ...pageDraft, description: v })}
            placeholder="A concise summary that sells the click."
          />
          <LabeledInput
            label="Keywords (comma separated)"
            testId="seo-keywords-input"
            value={(pageDraft.keywords || []).join(", ")}
            onChange={(v) => setPageDraft({ ...pageDraft, keywords: v.split(",").map((k) => k.trim()).filter(Boolean) })}
            placeholder="pasta, delivery, italian"
          />
          <LabeledInput
            label="Canonical URL (override)"
            testId="seo-canonical-input"
            value={pageDraft.canonical_url || ""}
            onChange={(v) => setPageDraft({ ...pageDraft, canonical_url: v })}
            placeholder="Leave blank to auto-derive"
          />
        </EditorCard>

        <EditorCard title="Open Graph / Social" subtitle="How link previews render on Facebook, LinkedIn, Slack." icon={Share2}>
          <LabeledInput
            label="OG Title (falls back to Title)"
            testId="seo-og-title-input"
            counterMax={70}
            value={pageDraft.og_title || ""}
            onChange={(v) => setPageDraft({ ...pageDraft, og_title: v })}
          />
          <LabeledTextarea
            label="OG Description (falls back to Description)"
            testId="seo-og-desc-input"
            counterMax={200}
            value={pageDraft.og_description || ""}
            onChange={(v) => setPageDraft({ ...pageDraft, og_description: v })}
          />
          <LabeledInput
            label="OG Image URL (1200×630 recommended)"
            testId="seo-og-image-input"
            value={pageDraft.og_image_url || ""}
            onChange={(v) => setPageDraft({ ...pageDraft, og_image_url: v })}
            placeholder="https://…"
          />
          <div>
            <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Twitter card</Label>
            <Select value={pageDraft.twitter_card || "summary_large_image"} onValueChange={(v) => setPageDraft({ ...pageDraft, twitter_card: v })}>
              <SelectTrigger data-testid="seo-twitter-card-select" className="mt-1.5 w-full max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="summary_large_image">Large image</SelectItem>
                <SelectItem value="summary">Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </EditorCard>

        <EditorCard title="Robots" subtitle="Control indexing for this specific page." icon={ShieldCheck}>
          <ToggleRow
            title="noindex"
            subtitle="Hide from search engines entirely."
            checked={!!pageDraft.noindex}
            onCheckedChange={(v) => setPageDraft({ ...pageDraft, noindex: v })}
            testId="seo-noindex-switch"
          />
          <ToggleRow
            title="nofollow"
            subtitle="Tell crawlers not to follow links on this page."
            checked={!!pageDraft.nofollow}
            onCheckedChange={(v) => setPageDraft({ ...pageDraft, nofollow: v })}
            testId="seo-nofollow-switch"
          />
        </EditorCard>

        <div className="flex gap-2">
          {pageDirty && (
            <button data-testid="seo-page-discard-btn" onClick={discard} className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text-secondary font-body text-sm font-medium rounded-full hover:bg-brand-surface">
              <RotateCcw size={14} /> Discard
            </button>
          )}
          <button
            data-testid="seo-page-save-btn"
            onClick={save}
            disabled={saving || !pageDirty}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {pageDirty ? "Save page SEO" : "Saved"}
          </button>
        </div>
      </section>

      {/* Right: previews */}
      <aside className="space-y-5 sticky top-6 self-start">
        <SerpPreview url={fullUrl} title={effectiveTitle} description={effectiveDesc} />
        <OgCardPreview url={fullUrl} title={effectiveTitle} description={effectiveDesc} image={effectiveImg} />
      </aside>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder, testId, counterMax }) {
  const len = (value || "").length;
  const over = counterMax && len > counterMax;
  const short = counterMax && len > 0 && len < Math.round(counterMax * 0.5);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">{label}</Label>
        {counterMax && (
          <span data-testid={`${testId}-counter`} className={`text-[11px] font-body ${over ? "text-red-600" : short ? "text-amber-600" : "text-brand-text-secondary"}`}>{len}/{counterMax}</span>
        )}
      </div>
      <Input data-testid={testId} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1.5" />
    </div>
  );
}

function LabeledTextarea({ label, value, onChange, placeholder, testId, counterMax }) {
  const len = (value || "").length;
  const over = counterMax && len > counterMax;
  const short = counterMax && len > 0 && len < Math.round(counterMax * 0.4);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">{label}</Label>
        {counterMax && (
          <span data-testid={`${testId}-counter`} className={`text-[11px] font-body ${over ? "text-red-600" : short ? "text-amber-600" : "text-brand-text-secondary"}`}>{len}/{counterMax}</span>
        )}
      </div>
      <Textarea data-testid={testId} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1.5 min-h-[88px]" />
    </div>
  );
}

function EditorCard({ title, subtitle, icon: Icon, children }) {
  return (
    <section className="bg-brand-surface border border-brand-border rounded-2xl p-5">
      <div className="mb-4">
        <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2">
          {Icon && <Icon size={16} className="text-brand-primary" />} {title}
        </h2>
        {subtitle && <p className="font-body text-xs text-brand-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ToggleRow({ title, subtitle, checked, onCheckedChange, testId }) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-brand-border bg-brand-bg mb-2">
      <div>
        <div className="font-body text-sm font-semibold text-brand-text">{title}</div>
        <div className="text-[11px] text-brand-text-secondary mt-0.5">{subtitle}</div>
      </div>
      <Switch data-testid={testId} checked={!!checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

// ─── Previews ────────────────────────────────────────────────

function SerpPreview({ url, title, description }) {
  return (
    <div data-testid="seo-serp-preview" className="bg-white border border-brand-border rounded-2xl p-5 shadow-sm">
      <div className="text-[11px] uppercase tracking-wider text-brand-text-secondary font-body font-semibold mb-3 flex items-center gap-1.5"><SearchIcon size={12} /> Google result preview</div>
      <div className="text-[13px] text-gray-600 truncate">{url || "https://example.com/"}</div>
      <div data-testid="seo-serp-title" className="text-[20px] leading-tight text-[#1a0dab] hover:underline cursor-pointer mt-0.5 line-clamp-2">{title || "Your page title appears here"}</div>
      <div data-testid="seo-serp-desc" className="text-[13px] text-gray-700 mt-1 line-clamp-3">{description || "Your meta description appears here."}</div>
    </div>
  );
}

function OgCardPreview({ url, title, description, image }) {
  let domain = "";
  try { domain = new URL(url).hostname; } catch (err) { /* invalid URL — leave domain empty */ void err; }
  return (
    <div data-testid="seo-og-preview" className="bg-white border border-brand-border rounded-2xl overflow-hidden shadow-sm">
      <div className="text-[11px] uppercase tracking-wider text-brand-text-secondary font-body font-semibold mb-0 flex items-center gap-1.5 px-5 pt-4 pb-3"><Share2 size={12} /> Social card preview</div>
      <div className="aspect-[1200/630] bg-gradient-to-br from-brand-primary/10 to-brand-primary/5 flex items-center justify-center overflow-hidden">
        {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : <span className="text-xs text-brand-text-secondary">No OG image set</span>}
      </div>
      <div className="p-4 border-t border-brand-border bg-gray-50">
        <div className="text-[11px] uppercase text-gray-500 tracking-wide">{domain || "example.com"}</div>
        <div className="text-[15px] font-semibold text-gray-900 mt-0.5 line-clamp-2">{title || "Your page title appears here"}</div>
        <div className="text-[12px] text-gray-600 mt-1 line-clamp-2">{description || "Your meta description appears here."}</div>
      </div>
    </div>
  );
}

// ─── Structured Data Tab ─────────────────────────────────────

function StructuredDataTab({ pageDraft, setPageDraft, pages, activePageKey, setActivePageKey, available, pageDirty, saving, save, livePreview }) {
  const selected = new Set(pageDraft.structured_data_types || []);
  const toggle = (t) => {
    const next = new Set(selected);
    next.has(t) ? next.delete(t) : next.add(t);
    setPageDraft({ ...pageDraft, structured_data_types: [...next] });
  };
  const jsonText = JSON.stringify(livePreview?.structured_data || [], null, 2);
  const copy = () => { navigator.clipboard.writeText(jsonText); toast.success("JSON-LD copied"); };
  const gsdtUrl = `https://search.google.com/test/rich-results?url=${encodeURIComponent(livePreview?.canonical_url || "")}`;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">
      <aside className="bg-brand-surface border border-brand-border rounded-2xl p-3 h-fit sticky top-6 self-start">
        <div className="px-2 pb-2 font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Pages</div>
        <div className="flex flex-col gap-0.5">
          {pages.map((p) => (
            <button
              key={p.page_key}
              data-testid={`seo-struct-page-btn-${p.page_key}`}
              onClick={() => setActivePageKey(p.page_key)}
              className={`text-left px-3 py-2 rounded-lg text-sm font-body ${p.page_key === activePageKey ? "bg-brand-primary text-white" : "text-brand-text hover:bg-brand-bg"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </aside>

      <div className="space-y-5">
        <EditorCard title="Schema.org types" subtitle="Enable the structured data blocks to inject as JSON-LD for this page." icon={Braces}>
          <div data-testid="seo-struct-toggle-grid" className="flex flex-wrap gap-2">
            {available.map((t) => {
              const active = selected.has(t);
              return (
                <button
                  key={t}
                  data-testid={`seo-struct-toggle-${t}`}
                  onClick={() => toggle(t)}
                  className={`px-3.5 py-1.5 rounded-full border text-xs font-body font-medium transition ${active ? "bg-brand-primary text-white border-brand-primary" : "border-brand-border text-brand-text hover:border-brand-primary/50"}`}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 mt-5">
            <button
              data-testid="seo-struct-save-btn"
              onClick={save}
              disabled={saving || !pageDirty}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {pageDirty ? "Save structured data" : "Saved"}
            </button>
          </div>
        </EditorCard>

        <EditorCard title="Live JSON-LD preview" subtitle="This is exactly what crawlers will see in <script type=application/ld+json>." icon={FileCode}>
          <div className="flex gap-2 mb-3">
            <button data-testid="seo-struct-copy-btn" onClick={copy} className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text font-body text-xs font-medium rounded-full hover:bg-brand-surface">
              <Copy size={12} /> Copy JSON
            </button>
            {livePreview?.canonical_url && (
              <a data-testid="seo-struct-test-link" href={gsdtUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text font-body text-xs font-medium rounded-full hover:bg-brand-surface">
                <ExternalLink size={12} /> Test with Google
              </a>
            )}
          </div>
          <pre data-testid="seo-struct-json" className="bg-brand-bg text-[12px] font-mono p-4 rounded-lg border border-brand-border overflow-auto max-h-[420px] whitespace-pre-wrap">{jsonText || "(empty)"}</pre>
        </EditorCard>
      </div>
    </div>
  );
}

// ─── Global Tab ─────────────────────────────────────────────

function GlobalTab({ globalDraft, setGlobalDraft, globalDirty, saving, save, discard }) {
  const setField = (k, v) => setGlobalDraft({ ...globalDraft, [k]: v });
  const setNested = (parent, k, v) => setGlobalDraft({ ...globalDraft, [parent]: { ...globalDraft[parent], [k]: v } });

  return (
    <div className="max-w-3xl space-y-5">
      <EditorCard title="Site-wide defaults" subtitle="Applied when a page doesn't have its own value." icon={Globe}>
        <LabeledInput label="Canonical site URL" testId="seo-global-site-url" value={globalDraft.site_url || ""} onChange={(v) => setField("site_url", v)} placeholder="https://www.yourdomain.com" />
        <LabeledInput label="Default title suffix" testId="seo-global-title-suffix" value={globalDraft.default_title_suffix || ""} onChange={(v) => setField("default_title_suffix", v)} placeholder=" — Brand name" />
        <LabeledTextarea label="Default meta description" testId="seo-global-default-desc" counterMax={160} value={globalDraft.default_description || ""} onChange={(v) => setField("default_description", v)} />
        <LabeledInput label="Default OG image URL" testId="seo-global-default-og" value={globalDraft.default_og_image_url || ""} onChange={(v) => setField("default_og_image_url", v)} />
      </EditorCard>

      <EditorCard title="Verification & social IDs" subtitle="Used by search consoles and social platforms." icon={ShieldCheck}>
        <LabeledInput label="Google Search Console verification" testId="seo-global-google-verify" value={globalDraft.google_verification || ""} onChange={(v) => setField("google_verification", v)} placeholder="content value from meta tag" />
        <LabeledInput label="Bing Webmaster verification" testId="seo-global-bing-verify" value={globalDraft.bing_verification || ""} onChange={(v) => setField("bing_verification", v)} />
        <LabeledInput label="Twitter handle" testId="seo-global-twitter" value={globalDraft.twitter_handle || ""} onChange={(v) => setField("twitter_handle", v)} placeholder="@yourbrand" />
        <LabeledInput label="Facebook App ID" testId="seo-global-fb-app" value={globalDraft.facebook_app_id || ""} onChange={(v) => setField("facebook_app_id", v)} />
      </EditorCard>

      <EditorCard title="Organization" subtitle="Used for Organization schema + legal tags." icon={Heart}>
        <LabeledInput label="Legal name" testId="seo-org-legal" value={globalDraft.organization?.legal_name || ""} onChange={(v) => setNested("organization", "legal_name", v)} />
        <LabeledInput label="Founding date" testId="seo-org-founded" value={globalDraft.organization?.founding_date || ""} onChange={(v) => setNested("organization", "founding_date", v)} placeholder="YYYY-MM-DD" />
        <LabeledInput label="Tax ID" testId="seo-org-tax" value={globalDraft.organization?.tax_id || ""} onChange={(v) => setNested("organization", "tax_id", v)} />
      </EditorCard>

      <EditorCard title="Sitemap configuration" subtitle="Controls what gets auto-included in the sitemap.xml." icon={ListTree}>
        <ToggleRow title="Auto-include product pages" subtitle="Every available menu item gets its own sitemap URL." checked={!!globalDraft.sitemap?.auto_include_products} onCheckedChange={(v) => setNested("sitemap", "auto_include_products", v)} testId="seo-sitemap-products-switch" />
        <ToggleRow title="Auto-include category pages" subtitle="Every active category gets its own sitemap URL." checked={!!globalDraft.sitemap?.auto_include_categories} onCheckedChange={(v) => setNested("sitemap", "auto_include_categories", v)} testId="seo-sitemap-categories-switch" />
        <div className="mt-3">
          <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Change frequency</Label>
          <Select value={globalDraft.sitemap?.change_frequency || "weekly"} onValueChange={(v) => setNested("sitemap", "change_frequency", v)}>
            <SelectTrigger data-testid="seo-sitemap-freq-select" className="mt-1.5 w-full max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </EditorCard>

      <div className="flex gap-2">
        {globalDirty && <button data-testid="seo-global-discard-btn" onClick={discard} className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text-secondary font-body text-sm font-medium rounded-full hover:bg-brand-surface"><RotateCcw size={14} /> Discard</button>}
        <button data-testid="seo-global-save-btn" onClick={save} disabled={saving || !globalDirty} className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {globalDirty ? "Save global SEO" : "Saved"}
        </button>
      </div>
    </div>
  );
}

// ─── Redirects Tab ─────────────────────────────────────────

function RedirectsTab({ redirects, refresh }) {
  const [newR, setNewR] = useState({ from_path: "", to_path: "", status_code: 301 });
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!newR.from_path || !newR.to_path) return toast.error("From and To paths are required");
    setCreating(true);
    try {
      await axios.post(`${API}/admin/seo/redirects`, newR, { withCredentials: true });
      setNewR({ from_path: "", to_path: "", status_code: 301 });
      toast.success("Redirect created");
      await refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Create failed"); }
    finally { setCreating(false); }
  };

  const remove = async (rid) => {
    if (!window.confirm("Delete this redirect?")) return;
    try {
      await axios.delete(`${API}/admin/seo/redirects/${rid}`, { withCredentials: true });
      toast.success("Redirect removed");
      await refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Delete failed"); }
  };

  return (
    <div className="max-w-5xl space-y-5">
      <EditorCard title="New redirect" subtitle="Catch legacy paths and route them to the right page." icon={ArrowRight}>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_auto] gap-3 items-end">
          <div>
            <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">From path</Label>
            <Input data-testid="redirect-from-input" value={newR.from_path} onChange={(e) => setNewR({ ...newR, from_path: e.target.value })} placeholder="/old-menu" className="mt-1.5" />
          </div>
          <div>
            <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">To path</Label>
            <Input data-testid="redirect-to-input" value={newR.to_path} onChange={(e) => setNewR({ ...newR, to_path: e.target.value })} placeholder="/menu" className="mt-1.5" />
          </div>
          <div>
            <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Status</Label>
            <Select value={String(newR.status_code)} onValueChange={(v) => setNewR({ ...newR, status_code: Number(v) })}>
              <SelectTrigger data-testid="redirect-status-select" className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="301">301 Permanent</SelectItem>
                <SelectItem value="302">302 Temporary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button data-testid="redirect-create-btn" onClick={create} disabled={creating} className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
          </button>
        </div>
      </EditorCard>

      <section className="bg-brand-surface border border-brand-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_90px_80px_60px] text-[11px] uppercase tracking-wider text-brand-text-secondary font-body font-semibold bg-brand-bg px-5 py-3 border-b border-brand-border">
          <div>From</div><div>To</div><div>Code</div><div>Hits</div><div></div>
        </div>
        {redirects.length === 0 && <div data-testid="redirect-empty" className="p-10 text-center text-sm font-body text-brand-text-secondary">No redirects yet.</div>}
        {redirects.map((r) => (
          <div key={r.id} data-testid={`redirect-row-${r.id}`} className="grid grid-cols-[1fr_1fr_90px_80px_60px] items-center px-5 py-3 border-b border-brand-border last:border-0 text-sm font-body">
            <div className="text-brand-text font-mono text-[13px]">{r.from_path}</div>
            <div className="text-brand-text font-mono text-[13px] flex items-center gap-1"><ArrowRight size={12} className="text-brand-text-secondary" /> {r.to_path}</div>
            <div className="text-brand-text">{r.status_code}</div>
            <div className="text-brand-text-secondary">{r.hits}</div>
            <button data-testid={`redirect-delete-btn-${r.id}`} onClick={() => remove(r.id)} className="text-brand-text-secondary hover:text-red-600"><Trash2 size={14} /></button>
          </div>
        ))}
      </section>
    </div>
  );
}

// ─── Sitemap & Robots Tab ────────────────────────────────

function SitemapRobotsTab({ sitemapPreview, refreshSitemap, robotsPreview, refreshRobots, siteUrl }) {
  useEffect(() => { refreshSitemap(); refreshRobots(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const downloadSitemap = () => window.open(`${API}/seo/sitemap.xml`, "_blank");
  const downloadRobots = () => window.open(`${API}/seo/robots.txt`, "_blank");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <EditorCard title="Sitemap.xml" subtitle={`Public endpoint: ${siteUrl ? `${siteUrl.replace(/\/$/, "")}/api/seo/sitemap.xml` : "/api/seo/sitemap.xml"}`} icon={ListTree}>
        <div className="flex gap-2 mb-3">
          <button data-testid="sitemap-refresh-btn" onClick={refreshSitemap} className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text font-body text-xs font-medium rounded-full hover:bg-brand-surface"><RotateCcw size={12} /> Regenerate</button>
          <button data-testid="sitemap-download-btn" onClick={downloadSitemap} className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text font-body text-xs font-medium rounded-full hover:bg-brand-surface"><Download size={12} /> Open XML</button>
        </div>
        <div data-testid="sitemap-count" className="text-xs text-brand-text-secondary mb-2">{sitemapPreview?.count ?? 0} URLs</div>
        <div className="max-h-96 overflow-auto border border-brand-border rounded-lg bg-brand-bg">
          <div className="overflow-x-auto -mx-6 px-6"><table className="w-full text-[12px] font-mono min-w-[640px]">
            <tbody>
              {(sitemapPreview?.entries || []).map((e, i) => (
                <tr key={i} data-testid={`sitemap-row-${i}`} className="border-b border-brand-border last:border-0">
                  <td className="px-3 py-2 truncate max-w-[320px]"><a href={e.loc} target="_blank" rel="noreferrer" className="text-brand-primary hover:underline">{e.loc.replace(siteUrl || "", "")}</a></td>
                  <td className="px-3 py-2 text-brand-text-secondary">{e.priority}</td>
                  <td className="px-3 py-2 text-brand-text-secondary">{e.changefreq}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </EditorCard>

      <EditorCard title="Robots.txt" subtitle={`Public endpoint: ${siteUrl ? `${siteUrl.replace(/\/$/, "")}/api/seo/robots.txt` : "/api/seo/robots.txt"}`} icon={ShieldCheck}>
        <div className="flex gap-2 mb-3">
          <button data-testid="robots-refresh-btn" onClick={refreshRobots} className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text font-body text-xs font-medium rounded-full hover:bg-brand-surface"><RotateCcw size={12} /> Regenerate</button>
          <button data-testid="robots-download-btn" onClick={downloadRobots} className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text font-body text-xs font-medium rounded-full hover:bg-brand-surface"><Download size={12} /> Open TXT</button>
        </div>
        <pre data-testid="robots-preview" className="bg-brand-bg text-[12px] font-mono p-4 rounded-lg border border-brand-border overflow-auto max-h-96 whitespace-pre-wrap">{robotsPreview || "(generating…)"}</pre>
        <p className="text-[11px] text-brand-text-secondary mt-3">Disallow rules are managed on the Global tab.</p>
      </EditorCard>
    </div>
  );
}

// ─── Health Tab ────────────────────────────────────────────

function HealthScoreBadge({ score, summary }) {
  const color = score >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : score >= 50 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200";
  return (
    <div data-testid="seo-health-badge" className={`inline-flex items-center gap-3 px-4 py-2 rounded-full border ${color}`}>
      <div className="text-2xl font-heading font-bold leading-none">{score}</div>
      <div className="text-[11px] font-body leading-tight">
        <div>SEO score</div>
        <div className="text-brand-text-secondary">{summary?.pass || 0} pass · {summary?.warn || 0} warn · {summary?.fail || 0} fail</div>
      </div>
    </div>
  );
}

function HealthTab({ health, refresh }) {
  if (!health) return null;
  const dot = (s) => s === "pass" ? "bg-emerald-500" : s === "warn" ? "bg-amber-500" : "bg-red-500";
  const groups = { fail: [], warn: [], pass: [] };
  (health.checks || []).forEach((c) => groups[c.status]?.push(c));
  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <HealthScoreBadge score={health.score} summary={health.summary} />
        <button data-testid="seo-health-refresh-btn" onClick={refresh} className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text font-body text-sm font-medium rounded-full hover:bg-brand-surface"><RotateCcw size={14} /> Re-run audit</button>
      </div>

      {["fail", "warn", "pass"].map((key) => groups[key].length > 0 && (
        <section key={key} className="mb-5">
          <h3 className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold mb-2">
            {key === "fail" ? "Needs fixing" : key === "warn" ? "Opportunities" : "Looking good"} ({groups[key].length})
          </h3>
          <div className="bg-brand-surface border border-brand-border rounded-2xl overflow-hidden">
            {groups[key].map((c) => (
              <div key={c.code} data-testid={`seo-health-check-${c.code}`} className="flex items-start gap-3 px-5 py-3 border-b border-brand-border last:border-0">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${dot(c.status)}`}></div>
                <div className="flex-1">
                  <div className="font-body text-sm font-semibold text-brand-text">{c.label}</div>
                  {c.detail && <div className="font-body text-xs text-brand-text-secondary mt-0.5">{c.detail}</div>}
                </div>
                <span className="font-body text-[10px] uppercase tracking-wider text-brand-text-secondary">{c.severity}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
