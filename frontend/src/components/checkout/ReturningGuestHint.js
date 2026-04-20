import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { Info, ArrowRight } from "lucide-react";

const API = "/api";

/**
 * Debounced email-exists check. If the entered guest email already has an account,
 * show an inline prompt suggesting sign-in.
 */
export default function ReturningGuestHint({ email }) {
  const [exists, setExists] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setExists(false);
    const clean = (email || "").trim().toLowerCase();
    if (!clean || !/\S+@\S+\.\S+/.test(clean)) return;
    const t = setTimeout(() => {
      axios.post(`${API}/auth/check-email`, { email: clean })
        .then(({ data }) => setExists(!!data.exists))
        .catch(() => setExists(false));
    }, 450);
    return () => clearTimeout(t);
  }, [email]);

  if (!exists) return null;

  return (
    <div data-testid="returning-guest-hint" className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
      <Info size={14} className="text-amber-700 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-body text-xs text-amber-900 leading-relaxed">
          We found an account with this email. <span className="font-semibold">Sign in</span> to access your order history, saved addresses, and loyalty points.
        </p>
        <Link
          to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}&email=${encodeURIComponent(email)}`}
          data-testid="returning-guest-signin-link"
          className="mt-1.5 inline-flex items-center gap-1 font-body text-xs font-semibold text-amber-800 hover:underline"
        >
          Sign in instead <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  );
}
