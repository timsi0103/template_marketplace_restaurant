import { useEffect, useState } from "react";
import axios from "axios";

const API = "/api";

let cachedSettings = null;
const listeners = new Set();

export function useStorefront() {
  const [settings, setSettings] = useState(cachedSettings);
  useEffect(() => {
    if (cachedSettings) {
      setSettings(cachedSettings);
      applyStorefrontMeta(cachedSettings);
    } else {
      axios.get(`${API}/storefront/settings`).then(({ data }) => {
        cachedSettings = data;
        setSettings(data);
        applyStorefrontMeta(data);
        listeners.forEach((l) => l(data));
      }).catch(() => { /* ignore */ });
    }
    const handler = (s) => setSettings(s);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);
  return settings;
}

export function refreshStorefront() {
  return axios.get(`${API}/storefront/settings`).then(({ data }) => {
    cachedSettings = data;
    applyStorefrontMeta(data);
    listeners.forEach((l) => l(data));
    return data;
  });
}

/** Apply SEO metadata + brand colors to the document. */
export function applyStorefrontMeta(settings) {
  if (!settings) return;
  const seo = settings.seo || {};
  if (seo.title) document.title = seo.title;
  const ensureMeta = (attr, name, content) => {
    if (!content) return;
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };
  ensureMeta("name", "description", seo.description);
  ensureMeta("property", "og:title", seo.title);
  ensureMeta("property", "og:description", seo.description);
  ensureMeta("property", "og:image", seo.og_image_url);
  if (settings.favicon_url) {
    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = settings.favicon_url;
  }
  // Live brand colors
  const c = settings.colors || {};
  const root = document.documentElement;
  if (c.primary) {
    root.style.setProperty("--brand-primary", c.primary);
    root.style.setProperty("--brand-primary-hover", shade(c.primary, -14));
  }
  if (c.secondary) {
    root.style.setProperty("--brand-orange", c.secondary);
    root.style.setProperty("--brand-orange-hover", shade(c.secondary, -12));
  }
  if (c.accent) root.style.setProperty("--brand-accent", c.accent);
}

/** Lighten/darken a hex color by `pct` percent (negative darkens). */
function shade(hex, pct) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return hex;
  const amt = Math.round(255 * (pct / 100));
  const clamp = (n) => Math.max(0, Math.min(255, n));
  const [r, g, b] = [1, 2, 3].map((i) => clamp(parseInt(m[i], 16) + amt));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}
