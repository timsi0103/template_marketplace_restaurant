import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Fix default marker icons (CRA doesn't bundle leaflet images correctly)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FlyTo({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (typeof lat === "number" && typeof lng === "number") {
      map.flyTo([lat, lng], 15, { duration: 0.8 });
    }
  }, [lat, lng, map]);
  return null;
}

export default function AddressAutocomplete({ value, onChange }) {
  const [query, setQuery] = useState(value?.line1 || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const search = (q) => {
    if (!q || q.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`, {
      headers: { "Accept-Language": "en" },
    })
      .then((r) => r.json())
      .then((data) => {
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  };

  const onQueryChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    onChange({ ...value, line1: q });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 400);
  };

  const pickResult = (r) => {
    const addr = r.address || {};
    const line1 = [addr.house_number, addr.road].filter(Boolean).join(" ") || r.display_name.split(",")[0];
    const city = addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || "";
    const postal = addr.postcode || "";
    onChange({
      ...value,
      label: value.label || line1,
      line1,
      city,
      postal_code: postal,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    });
    setQuery(line1);
    setOpen(false);
  };

  const hasPin = typeof value.lat === "number" && typeof value.lng === "number";
  const mapCenter = hasPin ? [value.lat, value.lng] : [40.7128, -74.006];

  return (
    <div data-testid="address-autocomplete" className="space-y-4">
      <div ref={wrapRef} className="relative">
        <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Street address</Label>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
          <Input
            data-testid="address-line1-input"
            value={query}
            onChange={onQueryChange}
            onFocus={() => query.length >= 3 && setOpen(true)}
            placeholder="Start typing your address…"
            className="bg-brand-bg border-brand-border h-12 pl-9 pr-9"
          />
          {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-brand-text-secondary" />}
        </div>
        {open && results.length > 0 && (
          <ul data-testid="address-suggestions" className="absolute z-50 mt-1 w-full bg-brand-surface border border-brand-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
            {results.map((r, idx) => (
              <li
                key={r.place_id}
                data-testid={`address-suggestion-${idx}`}
                onClick={() => pickResult(r)}
                className="flex items-start gap-2 px-3 py-2 hover:bg-brand-bg cursor-pointer border-b border-brand-border last:border-b-0"
              >
                <MapPin size={14} className="text-brand-primary mt-1 flex-shrink-0" />
                <div className="font-body text-xs text-brand-text">
                  <div className="font-semibold truncate">{r.display_name.split(",").slice(0, 2).join(",")}</div>
                  <div className="text-[11px] text-brand-text-secondary truncate">{r.display_name}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Apt / Suite</Label>
          <Input
            data-testid="address-line2-input"
            value={value.line2 || ""}
            onChange={(e) => onChange({ ...value, line2: e.target.value })}
            placeholder="Apt 4B"
            className="bg-brand-bg border-brand-border h-11"
          />
        </div>
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">City</Label>
          <Input
            data-testid="address-city-input"
            value={value.city || ""}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            placeholder="New York"
            className="bg-brand-bg border-brand-border h-11"
          />
        </div>
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Zip code</Label>
          <Input
            data-testid="address-postal-input"
            value={value.postal_code || ""}
            onChange={(e) => onChange({ ...value, postal_code: e.target.value })}
            placeholder="10013"
            className="bg-brand-bg border-brand-border h-11"
          />
        </div>
        <div>
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">Delivery notes</Label>
          <Input
            data-testid="address-notes-input"
            value={value.notes || ""}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            placeholder="Ring doorbell twice"
            className="bg-brand-bg border-brand-border h-11"
          />
        </div>
      </div>

      <div data-testid="address-map" className="rounded-xl overflow-hidden border border-brand-border h-52 relative">
        <MapContainer center={mapCenter} zoom={hasPin ? 15 : 12} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {hasPin && <Marker position={[value.lat, value.lng]} />}
          <FlyTo lat={value.lat} lng={value.lng} />
        </MapContainer>
        {!hasPin && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-brand-bg/60">
            <div className="text-center">
              <MapPin size={22} className="mx-auto text-brand-text-secondary mb-1" />
              <p className="font-body text-xs text-brand-text-secondary">Select an address to see the map preview</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
