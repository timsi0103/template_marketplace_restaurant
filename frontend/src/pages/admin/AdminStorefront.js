import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Save, Loader2, ExternalLink, Eye, RotateCcw, Palette, Type, Image as ImageIcon, Share2, Search, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { refreshStorefront } from "@/hooks/useStorefront";

const API = "/api";

export default function AdminStorefront() {
  const [s, setS] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/admin/storefront/settings`, { withCredentials: true })
      .then(({ data }) => { setS(data); setOriginal(JSON.parse(JSON.stringify(data))); })
      .catch(() => toast.error("Could not load storefront settings"))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !s) {
    return <div data-testid="storefront-loading" className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-brand-primary" /></div>;
  }

  const dirty = JSON.stringify(s) !== JSON.stringify(original);

  const set = (key, val) => setS((prev) => ({ ...prev, [key]: val }));
  const setNested = (section, key, val) => setS((prev) => ({
    ...prev, [section]: { ...(prev[section] || {}), [key]: val },
  }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        brand_name: s.brand_name, tagline: s.tagline,
        logo_url: s.logo_url, favicon_url: s.favicon_url,
        hero: s.hero, about: s.about, social: s.social,
        contact: s.contact, colors: s.colors, seo: s.seo,
      };
      const { data } = await axios.patch(`${API}/admin/storefront/settings`, payload, { withCredentials: true });
      setS(data); setOriginal(JSON.parse(JSON.stringify(data)));
      await refreshStorefront();
      toast.success("Storefront updated — live on site.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  };

  const reset = () => {
    if (!dirty) return;
    if (!window.confirm("Discard unsaved changes?")) return;
    setS(JSON.parse(JSON.stringify(original)));
  };

  return (
    <div data-testid="admin-storefront-page" className="p-6 lg:p-10 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 data-testid="storefront-title" className="font-heading text-3xl sm:text-4xl font-bold text-brand-text">Branded storefront</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">White-label your landing page — logo, hero, copy, colors, social, SEO.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/" target="_blank" data-testid="storefront-preview-btn" className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text font-body text-sm font-medium rounded-full hover:bg-brand-surface">
            <Eye size={14} /> Preview site <ExternalLink size={12} />
          </Link>
          {dirty && (
            <button data-testid="storefront-reset-btn" onClick={reset} className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-brand-text-secondary font-body text-sm font-medium rounded-full hover:bg-brand-surface">
              <RotateCcw size={14} /> Discard
            </button>
          )}
          <button
            data-testid="storefront-save-btn"
            onClick={save}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {dirty ? "Save & publish" : "Saved"}
          </button>
        </div>
      </div>

      <Section title="Brand identity" icon={Type}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Brand name">
            <Input data-testid="brand-name-input" value={s.brand_name || ""} onChange={(e) => set("brand_name", e.target.value)} />
          </Field>
          <Field label="Tagline">
            <Input data-testid="tagline-input" value={s.tagline || ""} onChange={(e) => set("tagline", e.target.value)} />
          </Field>
          <Field label="Logo URL" hint="Shown in footer. Leave blank to display brand name.">
            <Input data-testid="logo-url-input" placeholder="https://…/logo.png" value={s.logo_url || ""} onChange={(e) => set("logo_url", e.target.value)} />
          </Field>
          <Field label="Favicon URL">
            <Input data-testid="favicon-url-input" placeholder="https://…/favicon.ico" value={s.favicon_url || ""} onChange={(e) => set("favicon_url", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Brand colors" icon={Palette} subtitle="Applied instantly across buttons, accents, and highlights.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ColorField label="Primary" testId="color-primary" value={s.colors?.primary || "#6E1C1E"} onChange={(v) => setNested("colors", "primary", v)} />
          <ColorField label="Secondary" testId="color-secondary" value={s.colors?.secondary || "#E55A3D"} onChange={(v) => setNested("colors", "secondary", v)} />
          <ColorField label="Accent" testId="color-accent" value={s.colors?.accent || "#1E3A2F"} onChange={(v) => setNested("colors", "accent", v)} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 p-4 rounded-xl bg-brand-bg border border-brand-border">
          <span className="font-body text-xs uppercase tracking-wider text-brand-text-secondary font-semibold">Preview</span>
          <span className="px-4 py-1.5 rounded-full text-xs font-semibold text-white" style={{ background: s.colors?.primary }}>Primary</span>
          <span className="px-4 py-1.5 rounded-full text-xs font-semibold text-white" style={{ background: s.colors?.secondary }}>Secondary</span>
          <span className="px-4 py-1.5 rounded-full text-xs font-semibold text-white" style={{ background: s.colors?.accent }}>Accent</span>
          <Info size={12} className="text-brand-text-secondary ml-auto" />
          <span className="text-xs text-brand-text-secondary">Colors go live only after Save.</span>
        </div>
      </Section>

      <Section title="Hero section" icon={ImageIcon} subtitle="The first thing guests see on your landing page.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Eyebrow text" hint="Small uppercase label above title">
            <Input data-testid="hero-eyebrow-input" value={s.hero?.eyebrow || ""} onChange={(e) => setNested("hero", "eyebrow", e.target.value)} />
          </Field>
          <Field label="Image URL">
            <Input data-testid="hero-image-input" placeholder="https://…/hero.jpg" value={s.hero?.image_url || ""} onChange={(e) => setNested("hero", "image_url", e.target.value)} />
          </Field>
          <Field label="Title" className="sm:col-span-2">
            <Input data-testid="hero-title-input" value={s.hero?.title || ""} onChange={(e) => setNested("hero", "title", e.target.value)} />
          </Field>
          <Field label="Subtitle / description" className="sm:col-span-2">
            <Textarea data-testid="hero-subtitle-input" rows={3} value={s.hero?.subtitle || ""} onChange={(e) => setNested("hero", "subtitle", e.target.value)} />
          </Field>
          <Field label="CTA label">
            <Input data-testid="hero-cta-label-input" value={s.hero?.cta_label || ""} onChange={(e) => setNested("hero", "cta_label", e.target.value)} />
          </Field>
          <Field label="CTA link" hint="Internal path (e.g. /menu) or full URL">
            <Input data-testid="hero-cta-link-input" value={s.hero?.cta_link || ""} onChange={(e) => setNested("hero", "cta_link", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="About section" icon={Info}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Heading">
            <Input data-testid="about-heading-input" value={s.about?.heading || ""} onChange={(e) => setNested("about", "heading", e.target.value)} />
          </Field>
          <Field label="Team / kitchen image URL">
            <Input data-testid="about-image-input" value={s.about?.team_image_url || ""} onChange={(e) => setNested("about", "team_image_url", e.target.value)} />
          </Field>
          <Field label="Body copy" className="sm:col-span-2">
            <Textarea data-testid="about-body-input" rows={4} value={s.about?.body || ""} onChange={(e) => setNested("about", "body", e.target.value)} />
          </Field>
          <Field label="Mission quote" className="sm:col-span-2">
            <Textarea data-testid="about-mission-input" rows={2} value={s.about?.mission || ""} onChange={(e) => setNested("about", "mission", e.target.value)} />
          </Field>
          <Field label="Sourcing philosophy" className="sm:col-span-2">
            <Textarea data-testid="about-sourcing-input" rows={3} value={s.about?.sourcing || ""} onChange={(e) => setNested("about", "sourcing", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Contact & social" icon={Share2}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Email"><Input data-testid="contact-email-input" value={s.contact?.email || ""} onChange={(e) => setNested("contact", "email", e.target.value)} /></Field>
          <Field label="Phone"><Input data-testid="contact-phone-input" value={s.contact?.phone || ""} onChange={(e) => setNested("contact", "phone", e.target.value)} /></Field>
          <Field label="Address" className="sm:col-span-2"><Input data-testid="contact-address-input" value={s.contact?.address || ""} onChange={(e) => setNested("contact", "address", e.target.value)} /></Field>
          <Field label="Instagram URL"><Input data-testid="social-instagram-input" placeholder="https://instagram.com/…" value={s.social?.instagram || ""} onChange={(e) => setNested("social", "instagram", e.target.value)} /></Field>
          <Field label="Twitter / X URL"><Input data-testid="social-twitter-input" placeholder="https://x.com/…" value={s.social?.twitter || ""} onChange={(e) => setNested("social", "twitter", e.target.value)} /></Field>
          <Field label="Facebook URL"><Input data-testid="social-facebook-input" placeholder="https://facebook.com/…" value={s.social?.facebook || ""} onChange={(e) => setNested("social", "facebook", e.target.value)} /></Field>
          <Field label="TikTok URL"><Input data-testid="social-tiktok-input" placeholder="https://tiktok.com/@…" value={s.social?.tiktok || ""} onChange={(e) => setNested("social", "tiktok", e.target.value)} /></Field>
        </div>
      </Section>

      <Section title="SEO" icon={Search} subtitle="Shown on search engines and social shares.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Page title" className="sm:col-span-2">
            <Input data-testid="seo-title-input" value={s.seo?.title || ""} onChange={(e) => setNested("seo", "title", e.target.value)} />
          </Field>
          <Field label="Meta description" className="sm:col-span-2">
            <Textarea data-testid="seo-description-input" rows={3} value={s.seo?.description || ""} onChange={(e) => setNested("seo", "description", e.target.value)} />
          </Field>
          <Field label="Social share image URL" className="sm:col-span-2">
            <Input data-testid="seo-og-image-input" value={s.seo?.og_image_url || ""} onChange={(e) => setNested("seo", "og_image_url", e.target.value)} />
          </Field>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, subtitle, icon: Icon, children }) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="font-heading text-base font-bold text-brand-text inline-flex items-center gap-2">
          {Icon && <Icon size={16} className="text-brand-primary" />} {title}
        </h2>
        {subtitle && <p className="font-body text-xs text-brand-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children, className = "" }) {
  return (
    <div className={className}>
      <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary mb-1.5 block">{label}</Label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-brand-text-secondary/80">{hint}</p>}
    </div>
  );
}

function ColorField({ label, value, onChange, testId }) {
  return (
    <div>
      <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary mb-1.5 block">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          data-testid={`${testId}-picker`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded-lg border border-brand-border cursor-pointer bg-white"
          aria-label={`${label} color`}
        />
        <Input
          data-testid={`${testId}-hex`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono uppercase"
        />
      </div>
    </div>
  );
}
