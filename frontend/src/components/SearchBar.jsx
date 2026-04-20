import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search as SearchIcon, X, Loader2 } from "lucide-react";
import axios from "axios";

const API = "/api";

/** Compact search input with dropdown preview. Navigates to /search for full results. */
export default function SearchBar({ className = "" }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const navigate = useNavigate();

  // Debounced preview fetch
  useEffect(() => {
    if (!q.trim()) { setItems([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API}/search/menu`, { params: { q, limit: 6 } });
        setItems(data.items || []);
      } catch { setItems([]); }
      finally { setLoading(false); }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  // Click-outside
  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const submit = (e) => {
    e?.preventDefault?.();
    if (!q.trim()) return;
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div ref={boxRef} className={`relative ${className}`} data-testid="search-bar">
      <form onSubmit={submit} className="relative">
        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary pointer-events-none" />
        <input
          data-testid="search-input"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search menu, tags…"
          className="w-full pl-8 pr-8 h-9 rounded-full border border-brand-border bg-brand-surface focus:bg-white focus:border-brand-primary/60 text-sm outline-none transition"
        />
        {q && (
          <button type="button" onClick={() => { setQ(""); setItems([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-secondary hover:text-brand-primary" data-testid="search-clear-btn">
            <X size={14} />
          </button>
        )}
      </form>

      {open && q.trim() && (
        <div data-testid="search-dropdown" className="absolute top-full left-0 right-0 mt-1 bg-white border border-brand-border rounded-xl shadow-lg overflow-hidden z-50">
          {loading && <div className="p-3 flex items-center justify-center text-sm text-brand-text-secondary"><Loader2 size={14} className="animate-spin mr-2" /> Searching…</div>}
          {!loading && items.length === 0 && <div className="p-4 text-sm text-brand-text-secondary">No matches for “{q}”.</div>}
          {!loading && items.map((it) => (
            <Link
              key={it.id}
              to={`/menu/item/${it.id}`}
              data-testid={`search-result-${it.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 p-2.5 hover:bg-brand-surface transition"
            >
              {it.image ? (
                <img src={it.image} alt="" className="w-10 h-10 object-cover rounded-md" />
              ) : (
                <div className="w-10 h-10 bg-brand-surface rounded-md" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-body text-sm font-semibold text-brand-text truncate">{it.name}</div>
                <div className="text-xs text-brand-text-secondary capitalize">{it.category} · ${it.price?.toFixed?.(2) ?? it.price}</div>
              </div>
            </Link>
          ))}
          {!loading && items.length > 0 && (
            <button
              type="button"
              data-testid="search-view-all-btn"
              onClick={submit}
              className="w-full text-left p-2.5 border-t border-brand-border text-xs font-semibold text-brand-primary hover:bg-brand-surface"
            >
              View all results for “{q}” →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
