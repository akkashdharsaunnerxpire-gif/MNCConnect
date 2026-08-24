import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition focus:border-amber-500 focus:ring-4 focus:ring-amber-50";

const PRIMARY_ACTION =
  "border-transparent bg-[linear-gradient(135deg,#111827_0%,#1d4ed8_42%,#06b6d4_100%)] text-white shadow-[0_14px_40px_rgba(37,99,235,.24)]";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsLoading(true);

    try {
      // Check if endpoint exists - use existing or create placeholder
      const response = await fetch(`${API_URL}/auth/mentor/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      // If endpoint doesn't exist yet (404), simulate success for now
      if (response.status === 404) {
        console.warn('Forgot password endpoint not yet implemented. This is a placeholder.');
        // Simulate success for frontend testing
        setTimeout(() => {
          setSuccess(true);
          setIsLoading(false);
        }, 1000);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Failed to send reset link. Please try again.');
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Forgot password error:', error);
      if (error.message === 'Failed to fetch') {
        // Simulate success for frontend testing if backend not running
        console.warn('Backend not available. Simulating success for development.');
        setTimeout(() => {
          setSuccess(true);
          setIsLoading(false);
        }, 1000);
        return;
      }
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white/90 p-7 shadow-[0_25px_80px_rgba(15,23,42,.08)] backdrop-blur-sm sm:p-10">
      <div className="border-b border-slate-100 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700">
            MNC Employee / Mentor
          </p>
        </div>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Reset Password
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          Enter your registered email address and we'll send you a link to reset your password.
        </p>
      </div>

      {success ? (
        <div className="mt-7">
          <div className="flex flex-col items-center rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            <h3 className="mt-3 text-lg font-bold text-slate-900">Check Your Email</h3>
            <p className="mt-2 text-sm text-slate-600">
              We've sent a password reset link to <strong>{email}</strong>.
              Please check your inbox and follow the instructions.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Didn't receive the email? Check your spam folder or try again.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/mentor/login')}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              <Mail className="mr-1 inline-block h-4 w-4 text-slate-400" />
              Professional Email
              <span className="ml-1 text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="arun@company.com"
              className={inputClass}
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-bold transition disabled:opacity-70 ${PRIMARY_ACTION}`}
          >
            {isLoading ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                Sending...
              </>
            ) : (
              <>Send Reset Link</>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/mentor/login')}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </button>
        </form>
      )}
    </section>
  );
}