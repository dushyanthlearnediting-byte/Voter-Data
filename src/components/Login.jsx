import { useState } from 'react';
import { Vote, LogIn, Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { login } from '@/lib/api';

export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      onLoggedIn(user);
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(kind) {
    if (kind === 'admin') {
      setEmail('admin@ward.gov');
      setPassword('admin123');
    } else if (kind === 'sub') {
      setEmail('subadmin5@ward.gov');
      setPassword('sub123');
    } else {
      setEmail('data5@ward.gov');
      setPassword('data123');
    }
    setError('');
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="relative hidden lg:flex lg:w-[45%] bg-brand-700 text-white p-12 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand-400 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-brand-500 blur-3xl" />
        </div>
        <div className="relative flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Vote size={24} />
          </span>
          <span className="text-lg font-semibold tracking-tight">Ward Voter Data Manager</span>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Manage voter data,<br />ward by ward.
          </h1>
          <p className="mt-4 text-brand-100/90 text-lg max-w-md leading-relaxed">
            A clean, fast tool for field teams to track voter outreach across wards — search, filter, export and report in seconds.
          </p>
        </div>
        <p className="relative text-sm text-brand-100/70">Secure portal · For authorized staff only</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Vote size={24} />
            </span>
            <span className="text-lg font-semibold text-slate-900">Ward Voter Data Manager</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Enter your credentials to access the dashboard.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@ward.gov"
                  autoComplete="username"
                  className="w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-300 bg-white pl-11 pr-11 py-3 text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-brand-700 active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  Sign in
                </>
              )}
            </button>
          </form>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Demo accounts</p>
            <div className="grid gap-2">
              {[
                { k: 'admin', label: 'Admin', sub: 'admin@ward.gov' },
                { k: 'sub', label: 'Sub-Admin · Ward 5', sub: 'subadmin5@ward.gov' },
                { k: 'data', label: 'Data Entry · Ward 5', sub: 'data5@ward.gov' },
              ].map((d) => (
                <button
                  key={d.k}
                  onClick={() => fillDemo(d.k)}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-brand-50 hover:border-brand-200 transition group"
                >
                  <span>
                    <span className="block text-sm font-medium text-slate-800">{d.label}</span>
                    <span className="block text-xs text-slate-500">{d.sub}</span>
                  </span>
                  <span className="text-xs font-semibold text-brand-600 opacity-0 group-hover:opacity-100 transition">Use →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
