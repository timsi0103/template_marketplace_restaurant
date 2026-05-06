import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles, User as UserIcon } from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    key: "admin",
    label: "Admin dashboard",
    blurb: "Full control: catalog, orders, kitchen, staff, reviews.",
    email: "admin@culinaryeditorial.com",
    password: "Admin123!",
    redirect: "/admin",
    icon: Sparkles,
    accent: "from-brand-primary/10 to-brand-primary/5",
  },
  {
    key: "customer",
    label: "Customer account",
    blurb: "Browse the menu, place an order, leave a review.",
    email: "demo@culinaryeditorial.com",
    password: "Demo123!",
    redirect: "/menu",
    icon: UserIcon,
    accent: "from-amber-100 to-amber-50",
  },
];

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const redirectTo = sp.get("redirect") || "/";
  const prefilledEmail = sp.get("email") || "";
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demoKey, setDemoKey] = useState(null);

  useEffect(() => { if (prefilledEmail) setEmail(prefilledEmail); }, [prefilledEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (result.success) {
      navigate(redirectTo);
    } else {
      setError(result.error);
    }
  };

  const signInAs = async (account) => {
    setError("");
    setDemoKey(account.key);
    setEmail(account.email);
    setPassword(account.password);
    const result = await login(account.email, account.password);
    setDemoKey(null);
    if (result.success) {
      navigate(account.redirect);
    } else {
      setError(result.error || "Demo login failed");
    }
  };

  return (
    <div data-testid="login-page" className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Brand */}
        <Link to="/" className="block text-center mb-10">
          <h1 className="font-heading text-3xl font-bold text-brand-primary">
            The Culinary Editorial
          </h1>
          <p className="font-body text-sm text-brand-text-secondary mt-1">
            Welcome back, epicurean
          </p>
        </Link>

        {/* Card */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-8">
          <h2
            data-testid="login-heading"
            className="font-heading text-2xl font-bold text-brand-text mb-3"
          >
            Sign In
          </h2>

          {/* Demo accounts */}
          <div data-testid="demo-accounts" className="mb-6 space-y-2">
            <p className="font-body text-[11px] uppercase tracking-widest text-brand-text-secondary font-semibold">One-tap demo</p>
            {DEMO_ACCOUNTS.map((acc) => {
              const Icon = acc.icon;
              const loading = demoKey === acc.key;
              return (
                <button
                  key={acc.key}
                  type="button"
                  data-testid={`demo-login-${acc.key}`}
                  onClick={() => signInAs(acc)}
                  disabled={!!demoKey}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-brand-border bg-gradient-to-br ${acc.accent} text-left hover:border-brand-primary/40 active:scale-[0.99] disabled:opacity-60 transition-all`}
                >
                  <span className="w-9 h-9 rounded-full bg-white border border-brand-border flex items-center justify-center text-brand-primary flex-shrink-0">
                    <Icon size={16} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-heading text-sm font-bold text-brand-text">Try the {acc.label}</span>
                    <span className="block text-[11px] text-brand-text-secondary truncate">{acc.blurb}</span>
                  </span>
                  <ArrowRight size={14} className={`text-brand-text-secondary flex-shrink-0 ${loading ? "animate-pulse" : ""}`} />
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-brand-border" />
            <span className="font-body text-xs text-brand-text-secondary">or sign in with email</span>
            <div className="flex-1 h-px bg-brand-border" />
          </div>

          {error && (
            <div data-testid="login-error" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-body rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">
                Email
              </Label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
                <Input
                  data-testid="login-email-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 bg-brand-bg border-brand-border font-body text-sm h-11"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary">
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  data-testid="login-forgot-link"
                  className="font-body text-xs text-brand-primary hover:text-brand-primary-hover transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
                <Input
                  data-testid="login-password-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 bg-brand-bg border-brand-border font-body text-sm h-11"
                />
                <button
                  type="button"
                  data-testid="login-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-secondary hover:text-brand-text"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              data-testid="login-submit-btn"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover transition-colors disabled:opacity-50"
            >
              {submitting ? "Signing in..." : "Sign In"}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-brand-border" />
            <span className="font-body text-xs text-brand-text-secondary">or continue with</span>
            <div className="flex-1 h-px bg-brand-border" />
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3">
            <button
              data-testid="login-google-btn"
              onClick={loginWithGoogle}
              className="w-full flex items-center justify-center gap-3 py-2.5 bg-brand-surface border border-brand-border rounded-full font-body text-sm font-medium text-brand-text hover:bg-brand-bg transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </button>
            <button
              data-testid="login-apple-btn"
              className="w-full flex items-center justify-center gap-3 py-2.5 bg-brand-surface border border-brand-border rounded-full font-body text-sm font-medium text-brand-text hover:bg-brand-bg transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              Continue with Apple
            </button>
            <button
              data-testid="login-facebook-btn"
              className="w-full flex items-center justify-center gap-3 py-2.5 bg-brand-surface border border-brand-border rounded-full font-body text-sm font-medium text-brand-text hover:bg-brand-bg transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Continue with Facebook
            </button>
          </div>

          {/* Signup Link */}
          <p className="mt-6 text-center font-body text-sm text-brand-text-secondary">
            Don't have an account?{" "}
            <Link
              to="/signup"
              data-testid="login-signup-link"
              className="text-brand-primary font-medium hover:text-brand-primary-hover transition-colors"
            >
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
