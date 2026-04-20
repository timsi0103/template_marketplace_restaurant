/**
 * Generates short thermal-style kitchen chimes using Web Audio API.
 * Zero network cost, works offline.
 */
const CHIMES = {
  bell: { notes: [880, 0, 660], tone: "sine", dur: 0.18 },
  soft: { notes: [523.25, 659.25, 783.99], tone: "triangle", dur: 0.14 },
  ding: { notes: [1046.50], tone: "sine", dur: 0.42 },
  double: { notes: [784, 0, 784], tone: "square", dur: 0.1 },
};

export const CHIME_OPTIONS = [
  { id: "bell", label: "Bell (bright)" },
  { id: "soft", label: "Soft chime" },
  { id: "ding", label: "Long ding" },
  { id: "double", label: "Double tone" },
];

let audioCtx = null;
function ctx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { return null; }
  }
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

export function playChime(id = "bell", volume = 0.6) {
  const c = ctx();
  if (!c) return;
  const spec = CHIMES[id] || CHIMES.bell;
  const now = c.currentTime;
  const master = c.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume));
  master.connect(c.destination);

  spec.notes.forEach((freq, idx) => {
    const t0 = now + idx * spec.dur;
    if (!freq) return; // gap
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = spec.tone;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(1.0, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur * 0.95);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + spec.dur);
  });
}

export function playEscalation(id = "bell", volume = 1.0) {
  // Triple-tap for urgency
  playChime(id, volume);
  setTimeout(() => playChime(id, volume), 220);
  setTimeout(() => playChime(id, volume), 440);
}
