import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API = "/api";

export default function AcceptInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [status, setStatus] = useState("pending");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/invitations/${token}`);
        setInvite(data);
        setStatus(data.status);
        setName(data.name || "");
      } catch (e) {
        setStatus("notfound");
      } finally { setLoading(false); }
    })();
  }, [token]);

  const submit = async () => {
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setSubmitting(true);
    try {
      await axios.post(`${API}/invitations/${token}/accept`, { password, name });
      setAccepted(true);
      toast.success("Account created — signing you in…");
      try { await axios.post(`${API}/auth/login`, { email: invite.email, password }, { withCredentials: true }); } catch { /* ignore */ }
      setTimeout(() => navigate("/admin"), 1500);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Accept failed");
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-brand-bg"><Loader2 size={32} className="animate-spin text-brand-primary" /></div>;

  return (
    <div data-testid="accept-invite-page" className="min-h-screen flex items-center justify-center bg-brand-bg px-4">
      <div className="max-w-md w-full bg-brand-surface border border-brand-border rounded-2xl p-8 text-center">
        {(status === "notfound" || status === "revoked" || status === "expired") && (
          <div data-testid={`invite-state-${status}`}>
            <div className="w-14 h-14 rounded-full bg-red-50 border-2 border-red-200 inline-flex items-center justify-center mb-4">
              <XCircle size={28} className="text-red-600" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-brand-text mb-1">
              {status === "notfound" ? "Invitation not found" : status === "expired" ? "Invitation expired" : "Invitation revoked"}
            </h1>
            <p className="font-body text-sm text-brand-text-secondary">Ask your administrator to send a new invitation.</p>
          </div>
        )}

        {status === "accepted" && (
          <div data-testid="invite-state-accepted">
            <div className="w-14 h-14 rounded-full bg-amber-50 border-2 border-amber-200 inline-flex items-center justify-center mb-4">
              <AlertTriangle size={28} className="text-amber-600" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-brand-text mb-1">Already accepted</h1>
            <p className="font-body text-sm text-brand-text-secondary">This invitation has already been used. Please sign in with your password.</p>
            <button onClick={() => navigate("/login")} className="mt-4 px-5 py-2 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover">Sign in</button>
          </div>
        )}

        {status === "pending" && !accepted && (
          <>
            <div className="w-14 h-14 rounded-full bg-brand-primary/10 inline-flex items-center justify-center mb-4">
              <Shield size={28} className="text-brand-primary" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-brand-text mb-1">Welcome to the team</h1>
            <p className="font-body text-sm text-brand-text-secondary mb-5">
              You've been invited as <span className="font-semibold text-brand-text">{invite.role_name}</span>. Set a password to finish creating your account.
            </p>
            <div className="space-y-3 text-left">
              <div>
                <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Email</Label>
                <Input value={invite.email} disabled className="mt-1.5 bg-brand-bg" />
              </div>
              <div>
                <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Your name</Label>
                <Input data-testid="accept-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="mt-1.5" />
              </div>
              <div>
                <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Password (min 6)</Label>
                <Input data-testid="accept-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label className="font-body text-[11px] uppercase tracking-wider text-brand-text-secondary font-semibold">Confirm password</Label>
                <Input data-testid="accept-confirm-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1.5" />
              </div>
              <button
                onClick={submit}
                disabled={submitting}
                data-testid="accept-submit-btn"
                className="w-full inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover disabled:opacity-50"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Accept &amp; sign in
              </button>
            </div>
          </>
        )}

        {accepted && (
          <div data-testid="invite-state-success">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 inline-flex items-center justify-center mb-4">
              <CheckCircle2 size={28} className="text-emerald-600" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-brand-text mb-1">You're in</h1>
            <p className="font-body text-sm text-brand-text-secondary">Signing you in and redirecting to the admin dashboard…</p>
          </div>
        )}
      </div>
    </div>
  );
}
