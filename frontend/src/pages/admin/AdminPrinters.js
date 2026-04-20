import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Trash2, Printer as PrinterIcon, Wifi, WifiOff, Loader2, TestTube2, Edit3, Save, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

const API = "/api";
const MODEL_LABEL = {
  epson_tm_t20: "Epson TM-T20", epson_tm_t88: "Epson TM-T88", epson_tm_m30: "Epson TM-m30",
  star_tsp100: "Star TSP100", star_tsp650: "Star TSP650", star_sm_s230i: "Star SM-S230i",
  generic_80mm: "Generic 80mm", generic_58mm: "Generic 58mm",
};

function PrinterForm({ initial, models, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name || "",
    ip: initial?.ip || "",
    model: initial?.model || "generic_80mm",
    station: initial?.station || "kitchen",
    is_online: initial?.is_online ?? true,
  }));
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  return (
    <div data-testid="printer-form" className="bg-white border border-brand-border rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Printer name</Label>
          <Input data-testid="printer-name-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Kitchen printer 1" />
        </div>
        <div>
          <Label className="text-xs">Station</Label>
          <Input data-testid="printer-station-input" value={form.station} onChange={(e) => set("station", e.target.value.toLowerCase())} placeholder="kitchen | bar | receipt" />
        </div>
        <div>
          <Label className="text-xs">IP address</Label>
          <Input data-testid="printer-ip-input" value={form.ip} onChange={(e) => set("ip", e.target.value)} placeholder="192.168.1.50" />
        </div>
        <div>
          <Label className="text-xs">Model</Label>
          <select
            data-testid="printer-model-select"
            value={form.model}
            onChange={(e) => set("model", e.target.value)}
            className="w-full h-10 px-3 border border-brand-border rounded-md bg-white text-sm"
          >
            {models.map((m) => <option key={m} value={m}>{MODEL_LABEL[m] || m}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3 pt-5">
          <Switch data-testid="printer-online-switch" checked={form.is_online} onCheckedChange={(v) => set("is_online", v)} />
          <span className="text-sm font-body">{form.is_online ? "Online" : "Offline"}</span>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel} data-testid="printer-cancel-btn"><X size={14} className="mr-1" /> Cancel</Button>
        <Button size="sm" onClick={() => onSave(form)} data-testid="printer-save-btn" disabled={!form.name.trim()}><Save size={14} className="mr-1" /> Save</Button>
      </div>
    </div>
  );
}

export default function AdminPrinters() {
  const [loading, setLoading] = useState(true);
  const [printers, setPrinters] = useState([]);
  const [models, setModels] = useState([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    try {
      const { data } = await axios.get(`${API}/admin/printers`, { withCredentials: true });
      setPrinters(data.printers || []);
      setModels(data.models || []);
    } catch {
      toast.error("Could not load printers");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async (form) => {
    try {
      await axios.post(`${API}/admin/printers`, form, { withCredentials: true });
      toast.success("Printer added");
      setCreating(false);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not create"); }
  };
  const update = async (id, form) => {
    try {
      await axios.patch(`${API}/admin/printers/${id}`, form, { withCredentials: true });
      toast.success("Printer updated");
      setEditingId(null);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not update"); }
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this printer?")) return;
    try {
      await axios.delete(`${API}/admin/printers/${id}`, { withCredentials: true });
      toast.success("Printer deleted");
      load();
    } catch { toast.error("Could not delete"); }
  };
  const toggleOnline = async (p) => {
    await update(p.id, { is_online: !p.is_online });
  };
  const testPrint = async (p) => {
    try {
      await axios.post(`${API}/admin/printers/${p.id}/test`, {}, { withCredentials: true });
      toast.success(`Test job queued on ${p.name}`);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Test failed"); }
  };

  return (
    <div data-testid="admin-printers-page" className="p-6 sm:p-10 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-brand-text">Printers</h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">Configure thermal receipt &amp; kitchen printers. Routing follows your KDS station mapping.</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)} data-testid="add-printer-btn"><Plus size={14} className="mr-1" /> Add printer</Button>
      </div>

      {creating && (
        <div className="mb-4">
          <PrinterForm models={models} onSave={create} onCancel={() => setCreating(false)} />
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 size={28} className="animate-spin text-brand-primary" /></div>
      ) : printers.length === 0 && !creating ? (
        <div data-testid="no-printers" className="bg-brand-surface border border-dashed border-brand-border rounded-xl p-10 text-center">
          <PrinterIcon size={32} className="mx-auto mb-3 text-brand-text-secondary" />
          <p className="font-body text-sm text-brand-text-secondary">No printers yet. Add your first thermal printer to start routing kitchen tickets.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {printers.map((p) => editingId === p.id ? (
            <PrinterForm key={p.id} initial={p} models={models} onSave={(f) => update(p.id, f)} onCancel={() => setEditingId(null)} />
          ) : (
            <div key={p.id} data-testid={`printer-row-${p.id}`} className="bg-white border border-brand-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${p.is_online ? "bg-green-500/10 text-green-700" : "bg-brand-bg text-brand-text-secondary"}`}>
                <PrinterIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading text-base font-bold text-brand-text truncate">{p.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary uppercase font-semibold tracking-wider">{p.station}</span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${p.is_online ? "text-green-700" : "text-red-600"}`} data-testid={`printer-status-${p.id}`}>
                    {p.is_online ? <><Wifi size={12} /> Online</> : <><WifiOff size={12} /> Offline</>}
                  </span>
                </div>
                <div className="font-body text-xs text-brand-text-secondary mt-1">
                  {MODEL_LABEL[p.model] || p.model} · {p.ip || "no IP"}
                  {p.last_test_at && <> · last test {new Date(p.last_test_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => toggleOnline(p)} data-testid={`toggle-online-${p.id}`}>
                  {p.is_online ? <WifiOff size={14} className="mr-1" /> : <Wifi size={14} className="mr-1" />}
                  {p.is_online ? "Mark offline" : "Mark online"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => testPrint(p)} data-testid={`test-print-${p.id}`}>
                  <TestTube2 size={14} className="mr-1" /> Test print
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(p.id)} data-testid={`edit-printer-${p.id}`}>
                  <Edit3 size={14} className="mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(p.id)} data-testid={`delete-printer-${p.id}`} className="text-red-600 hover:text-red-700 hover:border-red-200">
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
