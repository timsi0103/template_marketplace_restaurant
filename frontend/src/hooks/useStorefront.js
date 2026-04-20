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
    } else {
      axios.get(`${API}/storefront/settings`).then(({ data }) => {
        cachedSettings = data;
        setSettings(data);
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
    listeners.forEach((l) => l(data));
    return data;
  });
}

/** Apply SEO metadata to the document head. */
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
}
