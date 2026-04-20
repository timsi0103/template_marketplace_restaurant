import { useEffect, useState } from "react";
import { Volume2, VolumeX, Bell, X, Play } from "lucide-react";
import { CHIME_OPTIONS, playChime } from "@/utils/chime";

export const DEFAULT_QUEUE_SETTINGS = {
  muted: false,
  volume: 0.6,
  chime: "bell",
  escalation_seconds: 60, // 30 | 60 | 120
  desktop_notifications: false,
};

const LS_KEY = "culinary_queue_settings_v1";

export function loadQueueSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_QUEUE_SETTINGS };
    return { ...DEFAULT_QUEUE_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_QUEUE_SETTINGS };
  }
}

export function saveQueueSettings(settings) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

export default function AudioSettingsModal({ open, onClose, settings, onChange }) {
  const [local, setLocal] = useState(settings);
  useEffect(() => { if (open) setLocal(settings); }, [open, settings]);
  if (!open) return null;
  const set = (k, v) => setLocal((s) => ({ ...s, [k]: v }));

  const requestNotify = async () => {
    if (!("Notification" in window)) {
      alert("Desktop notifications unsupported in this browser");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      new Notification("The Culinary Editorial", { body: "Sample notification — new orders will look like this.", icon: "/favicon.ico" });
      set("desktop_notifications", true);
    } else {
      set("desktop_notifications", false);
      alert("Permission denied. You can re-enable it from your browser settings.");
    }
  };

  const save = () => { onChange(local); onClose(); };

  return (
    <div data-testid="audio-settings-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-brand-border">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-brand-primary" />
            <h2 className="font-heading text-lg font-bold text-brand-text">Audio & Alert Settings</h2>
          </div>
          <button onClick={onClose} data-testid="close-audio-settings" className="text-brand-text-secondary hover:text-brand-text"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-6">
          {/* Mute */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-body text-sm font-semibold text-brand-text">Sound alerts</div>
              <div className="text-xs text-brand-text-secondary">Mute all chime alerts.</div>
            </div>
            <button
              data-testid="toggle-mute-btn"
              onClick={() => set("muted", !local.muted)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition ${local.muted ? "bg-brand-surface text-brand-text-secondary" : "bg-brand-primary text-white"}`}
            >
              {local.muted ? <><VolumeX size={14} /> Muted</> : <><Volume2 size={14} /> On</>}
            </button>
          </div>

          {/* Chime */}
          <div>
            <div className="font-body text-sm font-semibold text-brand-text mb-2">Chime</div>
            <div className="grid grid-cols-2 gap-2">
              {CHIME_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  data-testid={`chime-option-${c.id}`}
                  onClick={() => { set("chime", c.id); playChime(c.id, local.volume); }}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold transition ${local.chime === c.id ? "border-brand-primary bg-brand-primary/5 text-brand-primary" : "border-brand-border text-brand-text hover:border-brand-primary/40"}`}
                >
                  {c.label} <Play size={12} />
                </button>
              ))}
            </div>
          </div>

          {/* Volume */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="font-body text-sm font-semibold text-brand-text">Volume</div>
              <div className="text-xs text-brand-text-secondary">{Math.round(local.volume * 100)}%</div>
            </div>
            <input
              data-testid="volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={local.volume}
              onChange={(e) => set("volume", parseFloat(e.target.value))}
              className="w-full accent-brand-primary"
            />
          </div>

          {/* Escalation */}
          <div>
            <div className="font-body text-sm font-semibold text-brand-text mb-2">Escalating alert after</div>
            <div className="inline-flex rounded-full border border-brand-border p-1 bg-brand-surface">
              {[30, 60, 120].map((s) => (
                <button
                  key={s}
                  data-testid={`escalation-${s}`}
                  onClick={() => set("escalation_seconds", s)}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition ${local.escalation_seconds === s ? "bg-brand-primary text-white" : "text-brand-text-secondary"}`}
                >{s}s</button>
              ))}
            </div>
            <div className="text-xs text-brand-text-secondary mt-1.5">If an incoming order is still unaccepted after this time, a louder triple-tap chime will fire.</div>
          </div>

          {/* Desktop notifications */}
          <div>
            <div className="font-body text-sm font-semibold text-brand-text mb-2">Desktop notifications</div>
            <button
              data-testid="notify-permission-btn"
              onClick={requestNotify}
              className="px-3 py-1.5 rounded-full border border-brand-border text-xs font-semibold hover:border-brand-primary/40"
            >
              {local.desktop_notifications ? "✓ Enabled — tap to retest" : "Enable browser notifications"}
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-brand-border flex justify-end gap-2">
          <button onClick={onClose} data-testid="audio-settings-cancel" className="px-4 py-2 text-sm text-brand-text-secondary">Cancel</button>
          <button onClick={save} data-testid="audio-settings-save" className="px-4 py-2 text-sm font-semibold bg-brand-primary text-white rounded-full hover:bg-brand-primary-hover">Save</button>
        </div>
      </div>
    </div>
  );
}
