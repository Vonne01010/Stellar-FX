'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const { acceptInvite } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await acceptInvite(params.token, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept invite.');
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
              <p className="mb-1 text-center text-sm font-semibold text-slate-900">
                Welcome to Stellar FX
              </p>
              <p className="mb-4 text-center text-xs text-slate-600">
                Set a password to activate your account.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                {error && (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
                    {error}
                  </p>
                )}
                <input
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
                >
                  {submitting ? 'Activating…' : 'Activate account'}
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