import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Save, Percent, DollarSign, Truck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const API = "/api";

const TYPE_OPTIONS = [
  { key: "percent", label: "Percentage", desc: "% off the subtotal", icon: Percent },
  { key: "fixed", label: "Fixed amount", desc: "$ off the subtotal", icon: DollarSign },
  { key: "free_delivery", label: "Free delivery", desc: "Waive the delivery fee", icon: Truck },
];

export default function AdminCouponForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState({
    code: "",
    type: "percent",
    value: 10,
    min_subtotal: 0,
    description: "",
    usage_limit: "",
    first_order_only: false,
    expires_at: "",
    active: true,
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    axios
      .get(`${API}/admin/coupons/${id}`, { withCredentials: true })
      .then(({ data }) => {
        setForm({
          code: data.code || "",
          type: data.type || "percent",
          value: data.value ?? 0,
          min_subtotal: data.min_subtotal ?? 0,
          description: data.description || "",
          usage_limit: data.usage_limit ?? "",
          first_order_only: !!data.first_order_only,
          expires_at: data.expires_at || "",
          active: data.active !== false,
        });
      })
      .catch(() => toast.error("Could not load coupon"))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const validate = () => {
    if (!form.code.trim()) return "Code is required";
    if (!/^[A-Z0-9_-]{2,32}$/i.test(form.code.trim())) return "Code must be 2–32 alphanumeric characters";
    if (form.type === "percent" && (form.value <= 0 || form.value > 100)) return "Percentage must be between 1–100";
    if (form.type === "fixed" && form.value <= 0) return "Fixed amount must be greater than $0";
    if (form.min_subtotal < 0) return "Minimum order cannot be negative";
    if (form.usage_limit !== "" && Number(form.usage_limit) < 1) return "Usage limit must be at least 1";
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      min_subtotal: Number(form.min_subtotal || 0),
      description: form.description || "",
      usage_limit: form.usage_limit === "" ? null : Number(form.usage_limit),
      first_order_only: !!form.first_order_only,
      expires_at: form.expires_at || null,
      active: !!form.active,
    };
    try {
      if (isEdit) {
        await axios.put(`${API}/admin/coupons/${id}`, payload, { withCredentials: true });
        toast.success("Coupon updated");
      } else {
        await axios.post(`${API}/admin/coupons`, payload, { withCredentials: true });
        toast.success("Coupon created");
      }
      navigate("/admin/coupons");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div data-testid="admin-coupon-form-page" className="p-6 lg:p-10 max-w-3xl">
      <Link to="/admin/coupons" data-testid="coupon-back-btn" className="inline-flex items-center gap-1.5 font-body text-xs text-brand-text-secondary hover:text-brand-primary mb-4">
        <ArrowLeft size={14} /> Back to coupons
      </Link>
      <h1 className="font-heading text-3xl sm:text-4xl font-bold text-brand-text tracking-tight mb-1">{isEdit ? "Edit coupon" : "New coupon"}</h1>
      <p className="font-body text-sm text-brand-text-secondary mb-8">Configure the redemption rules for this promotion.</p>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Code */}
        <Field label="Code">
          <Input
            data-testid="coupon-code-input"
            value={form.code}
            onChange={(e) => update({ code: e.target.value.toUpperCase() })}
            placeholder="SUMMER20"
            className="bg-brand-bg border-brand-border font-mono tracking-wider uppercase h-11"
            maxLength={32}
          />
        </Field>

        {/* Type selector */}
        <div data-testid="coupon-type-group">
          <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-2 block">Discount type</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TYPE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = form.type === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  data-testid={`coupon-type-${opt.key}`}
                  onClick={() => update({ type: opt.key, value: opt.key === "free_delivery" ? 0 : form.value })}
                  className={`p-3 text-left rounded-xl border-2 transition ${active ? "border-brand-primary bg-brand-primary/5" : "border-brand-border bg-brand-bg hover:border-brand-primary/40"}`}
                >
                  <Icon size={16} className={active ? "text-brand-primary" : "text-brand-text-secondary"} />
                  <div className="font-heading text-sm font-bold text-brand-text mt-1">{opt.label}</div>
                  <div className="font-body text-[11px] text-brand-text-secondary">{opt.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Value + min subtotal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {form.type !== "free_delivery" && (
            <Field label={form.type === "percent" ? "Discount (%)" : "Discount amount ($)"}>
              <Input
                data-testid="coupon-value-input"
                type="number"
                min="0"
                step={form.type === "percent" ? "1" : "0.01"}
                value={form.value}
                onChange={(e) => update({ value: e.target.value === "" ? "" : Number(e.target.value) })}
                className="bg-brand-bg border-brand-border h-11"
              />
            </Field>
          )}
          <Field label="Minimum order ($)">
            <Input
              data-testid="coupon-min-input"
              type="number"
              min="0"
              step="0.01"
              value={form.min_subtotal}
              onChange={(e) => update({ min_subtotal: e.target.value === "" ? 0 : Number(e.target.value) })}
              className="bg-brand-bg border-brand-border h-11"
            />
          </Field>
        </div>

        {/* Expiry + usage limit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Expiry date (optional)">
            <Input
              data-testid="coupon-expiry-input"
              type="date"
              value={form.expires_at}
              min={today}
              onChange={(e) => update({ expires_at: e.target.value })}
              className="bg-brand-bg border-brand-border h-11"
            />
          </Field>
          <Field label="Usage limit (optional)">
            <Input
              data-testid="coupon-limit-input"
              type="number"
              min="1"
              value={form.usage_limit}
              onChange={(e) => update({ usage_limit: e.target.value === "" ? "" : Number(e.target.value) })}
              placeholder="Unlimited"
              className="bg-brand-bg border-brand-border h-11"
            />
          </Field>
        </div>

        {/* Description */}
        <Field label="Customer-facing description (optional)">
          <Input
            data-testid="coupon-desc-input"
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="20% off your first summer order"
            className="bg-brand-bg border-brand-border h-11"
          />
        </Field>

        {/* Toggles */}
        <div className="flex flex-col sm:flex-row gap-3">
          <ToggleRow
            testid="coupon-first-order-switch"
            label="First-order-only"
            desc="Only redeemable by customers placing their first paid order."
            checked={form.first_order_only}
            onCheckedChange={(v) => update({ first_order_only: v })}
          />
          <ToggleRow
            testid="coupon-active-switch"
            label="Active"
            desc="Inactive coupons cannot be redeemed."
            checked={form.active}
            onCheckedChange={(v) => update({ active: v })}
          />
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-border">
          <Link to="/admin/coupons" className="px-5 py-2.5 font-body text-sm border border-brand-border text-brand-text rounded-full hover:bg-brand-surface">
            Cancel
          </Link>
          <button
            type="submit"
            data-testid="coupon-save-btn"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50 transition"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isEdit ? "Save changes" : "Create coupon"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ testid, label, desc, checked, onCheckedChange }) {
  return (
    <div className="flex-1 flex items-start gap-3 p-4 rounded-xl border border-brand-border bg-brand-bg">
      <Switch data-testid={testid} checked={checked} onCheckedChange={onCheckedChange} />
      <div>
        <div className="font-heading text-sm font-semibold text-brand-text">{label}</div>
        <div className="font-body text-[11px] text-brand-text-secondary mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
