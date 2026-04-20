import { useRef, useState } from "react";
import axios from "axios";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const API = "/api";
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * Drag-drop / click image uploader. Persists to object storage via /api/admin/uploads.
 * Returns the proxy URL (e.g. /api/files/up_xxx) via onChange.
 */
export default function FileUploader({
  label, value, onChange, purpose = "misc",
  testId = "file-uploader", accept = "image/*",
  aspect = "aspect-[3/2]",
}) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("File too large", { description: `Max ${MAX_BYTES / 1024 / 1024} MB` });
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", purpose);
      const { data } = await axios.post(`${API}/admin/uploads`, fd, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange?.(data.url);
      toast.success("Uploaded");
    } catch (e) {
      toast.error("Upload failed", { description: e?.response?.data?.detail || e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid={testId}>
      {label && <div className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5 font-semibold">{label}</div>}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className={`relative ${aspect} rounded-xl border-2 border-dashed transition-colors overflow-hidden ${dragging ? "border-brand-primary bg-brand-primary/5" : "border-brand-border bg-brand-bg hover:border-brand-primary/40"}`}
      >
        {value ? (
          <>
            <img src={value} alt="" className="w-full h-full object-contain bg-white" data-testid={`${testId}-preview`} />
            <button
              type="button"
              data-testid={`${testId}-remove`}
              onClick={() => onChange?.("")}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
              aria-label="Remove"
            >
              <X size={13} />
            </button>
            <button
              type="button"
              data-testid={`${testId}-replace`}
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 text-brand-text hover:bg-white"
            >
              <Upload size={10} /> Replace
            </button>
          </>
        ) : (
          <button
            type="button"
            data-testid={`${testId}-pick`}
            onClick={() => fileRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-brand-text-secondary hover:text-brand-primary text-xs"
          >
            {busy ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={22} />}
            <span className="font-body font-semibold">{busy ? "Uploading…" : "Click or drop image"}</span>
            <span className="text-[10px] opacity-70">PNG / JPG / WebP · ≤ 6MB</span>
          </button>
        )}
        {busy && value && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
            <Loader2 size={22} className="animate-spin" />
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          data-testid={`${testId}-input`}
          className="hidden"
          onChange={(e) => upload(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
