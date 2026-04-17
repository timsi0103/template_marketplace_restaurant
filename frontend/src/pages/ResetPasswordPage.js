import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!token) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }
    setSubmitting(true);
    const result = await resetPassword(token, password);
    setSubmitting(false);
    if (result.success) {
      setSubmitted(true);
    } else {
      setError(result.error);
    }
  };

  return (
    <div data-testid="reset-password-page" className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Brand */}
        <Link to="/" className="block text-center mb-10">
          <h1 className="font-heading text-3xl font-bold text-brand-primary">
            The Culinary Editorial
          </h1>
        </Link>

        <div className="bg-brand-surface border border-brand-border rounded-2xl p-8">
          {!submitted ? (
            <>
              <h2
                data-testid="reset-heading"
                className="font-heading text-2xl font-bold text-brand-text mb-2"
              >
                Set New Password
              </h2>
              <p className="font-body text-sm text-brand-text-secondary mb-6">
                Choose a strong password for your account.
              </p>

              {error && (
                <div data-testid="reset-error" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-body rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">
                    New Password
                  </Label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
                    <Input
                      data-testid="reset-password-input"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pl-10 pr-10 bg-brand-bg border-brand-border font-body text-sm h-11"
                    />
                    <button
                      type="button"
                      data-testid="reset-toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-secondary hover:text-brand-text"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
                    <Input
                      data-testid="reset-confirm-input"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pl-10 bg-brand-bg border-brand-border font-body text-sm h-11"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  data-testid="reset-submit-btn"
                  disabled={submitting}
                  className="w-full py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover transition-colors disabled:opacity-50"
                >
                  {submitting ? "Resetting..." : "Reset Password"}
                </button>
              </form>
            </>
          ) : (
            /* Success Screen */
            <div data-testid="reset-success" className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-brand-text mb-2">
                Password Updated
              </h2>
              <p className="font-body text-sm text-brand-text-secondary mb-6">
                Your password has been changed successfully. You can now sign in with your new password.
              </p>
              <Link
                to="/login"
                data-testid="reset-to-login-btn"
                className="inline-flex items-center justify-center w-full py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover transition-colors"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
