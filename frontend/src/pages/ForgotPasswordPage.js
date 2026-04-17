import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await forgotPassword(email);
    setSubmitting(false);
    if (result.success) {
      setSubmitted(true);
    } else {
      setError(result.error);
    }
  };

  return (
    <div data-testid="forgot-password-page" className="min-h-screen flex items-center justify-center px-6 py-12">
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
              {/* Back link */}
              <Link
                to="/login"
                data-testid="forgot-back-link"
                className="inline-flex items-center gap-1.5 font-body text-sm text-brand-text-secondary hover:text-brand-text transition-colors mb-6"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </Link>

              <h2
                data-testid="forgot-heading"
                className="font-heading text-2xl font-bold text-brand-text mb-2"
              >
                Reset Password
              </h2>
              <p className="font-body text-sm text-brand-text-secondary mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              {error && (
                <div data-testid="forgot-error" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-body rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="font-body text-[10px] uppercase tracking-widest text-brand-text-secondary mb-1.5">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary" />
                    <Input
                      data-testid="forgot-email-input"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 bg-brand-bg border-brand-border font-body text-sm h-11"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  data-testid="forgot-submit-btn"
                  disabled={submitting}
                  className="w-full py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover transition-colors disabled:opacity-50"
                >
                  {submitting ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            </>
          ) : (
            /* Confirmation Screen */
            <div data-testid="forgot-confirmation" className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-brand-text mb-2">
                Check Your Email
              </h2>
              <p className="font-body text-sm text-brand-text-secondary mb-6 leading-relaxed">
                If an account exists for <span className="font-medium text-brand-text">{email}</span>,
                you'll receive a password reset link shortly.
              </p>
              <Link
                to="/login"
                data-testid="forgot-back-to-login"
                className="inline-flex items-center justify-center w-full py-3 bg-brand-primary text-white font-body text-sm font-semibold rounded-full hover:bg-brand-primary-hover transition-colors"
              >
                Return to Sign In
              </Link>
              <button
                data-testid="forgot-resend-btn"
                onClick={() => { setSubmitted(false); setEmail(""); }}
                className="mt-3 font-body text-xs text-brand-text-secondary hover:text-brand-text transition-colors"
              >
                Didn't receive it? Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
