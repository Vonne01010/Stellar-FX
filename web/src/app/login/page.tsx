'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.14),_transparent_42%),linear-gradient(135deg,_#f7f4ff_0%,_#f3edff_60%,_#eef2ff_100%)] px-2 py-3 text-slate-700 sm:px-4 sm:py-6">
      <div className="mx-auto flex h-[668px] max-h-[calc(100vh-1rem)] w-[340px] max-w-[calc(100vw-1rem)] flex-col gap-4 rounded-[36px] border border-violet-200/70 bg-white/90 p-2 shadow-[0_16px_50px_rgba(109,40,217,0.12)] backdrop-blur-xl sm:w-[360px] sm:max-w-[calc(100vw-2rem)]">
        <div className="mx-auto mb-1 h-1.5 w-20 rounded-full bg-violet-200/80" />
        <section className="flex flex-1 flex-col overflow-hidden rounded-[24px] border border-violet-100 bg-[#fcfbff]">
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-violet-100 p-4">
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.35em] text-violet-700">
              StellarX Console
            </p>
          </div>

          <div className="flex flex-1 flex-col justify-center p-5">
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
              <p className="mb-4 text-center text-sm font-semibold text-slate-900">
                Log in to Stellar FX
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                {error && (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
                    {error}
                  </p>
                )}
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
                >
                  {submitting ? 'Logging in…' : 'Log in'}
                </button>
              </form>
            </div>
          </div>
        </section>

        <footer className="px-2 text-center text-[10px] uppercase tracking-[0.3em] text-slate-500">
          Built for the StellarX workshop
        </footer>
      </div>
    </main>
  );
}