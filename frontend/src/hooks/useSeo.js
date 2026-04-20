import { useEffect } from "react";
import axios from "axios";

const API = "/api";
const cache = new Map(); // key → data

export function useSeo(pageKey, params = {}) {
  useEffect(() => {
    if (!pageKey) return;
    const cacheKey = `${pageKey}|${JSON.stringify(params || {})}`;
    const apply = (data) => applySeoToHead(data);
    if (cache.has(cacheKey)) {
      apply(cache.get(cacheKey));
      return;
    }
    const qs = new URLSearchParams(params || {}).toString();
    axios.get(`${API}/seo/page/${pageKey}${qs ? `?${qs}` : ""}`)
      .then(({ data }) => {
        cache.set(cacheKey, data);
        apply(data);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey, JSON.stringify(params || {})]);
}

function setMeta(selectorAttr, name, content) {
  if (content === null || content === undefined || content === "") {
    // Remove empty tags to avoid stale placeholders — but keep OG even if empty to preserve order
    const el = document.querySelector(`meta[${selectorAttr}="${name}"]`);
    if (el && el.getAttribute("data-seo-managed") === "true") el.remove();
    return;
  }
  let el = document.querySelector(`meta[${selectorAttr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(selectorAttr, name);
    el.setAttribute("data-seo-managed", "true");
    document.head.appendChild(el);
  } else {
    el.setAttribute("data-seo-managed", "true");
  }
  el.setAttribute("content", content);
}

function setLink(rel, href) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"][data-seo-managed="true"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    el.setAttribute("data-seo-managed", "true");
    document.head.appendChild(el);
  }
  el.href = href;
}

function setJsonLd(blocks) {
  document.querySelectorAll('script[type="application/ld+json"][data-seo-managed="true"]').forEach((el) => el.remove());
  (blocks || []).forEach((b) => {
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.setAttribute("data-seo-managed", "true");
    s.text = JSON.stringify(b);
    document.head.appendChild(s);
  });
}

export function applySeoToHead(data) {
  if (!data) return;
  const m = data.meta || {};
  if (m.title) document.title = m.title;
  setMeta("name", "description", m.description);
  setMeta("name", "keywords", (m.keywords || []).join(", "));
  const robots = [];
  if (m.noindex) robots.push("noindex");
  if (m.nofollow) robots.push("nofollow");
  setMeta("name", "robots", robots.join(", "));
  setMeta("property", "og:title", m.og_title || m.title);
  setMeta("property", "og:description", m.og_description || m.description);
  setMeta("property", "og:image", m.og_image_url);
  setMeta("property", "og:url", data.canonical_url);
  setMeta("property", "og:type", "website");
  setMeta("name", "twitter:card", m.twitter_card || "summary_large_image");
  if (m.twitter_handle) setMeta("name", "twitter:site", m.twitter_handle);
  setMeta("name", "twitter:title", m.og_title || m.title);
  setMeta("name", "twitter:description", m.og_description || m.description);
  setMeta("name", "twitter:image", m.og_image_url);
  const ver = data.verification || {};
  if (ver.google) setMeta("name", "google-site-verification", ver.google);
  if (ver.bing) setMeta("name", "msvalidate.01", ver.bing);
  if (data.facebook_app_id) setMeta("property", "fb:app_id", data.facebook_app_id);
  setLink("canonical", data.canonical_url);
  setJsonLd(data.structured_data || []);
}

export function clearSeoCache() {
  cache.clear();
}
