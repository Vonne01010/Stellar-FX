'use client';
import { useState, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import ConnectWallet from '@/components/ConnectWallet';
import FundAccount from '@/components/FundAccount';
import AddTrustline from '@/components/AddTrustline';
import BalanceCard from '@/components/BalanceCard';
import SendPayment from '@/components/SendPayment';
import SavingsGoal from '@/components/SavingsGoal';

export default function Home() {
  const wallet = useWallet();
  const { publicKey, connecting } = wallet;
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.14),_transparent_42%),linear-gradient(135deg,_#f7f4ff_0%,_#f3edff_60%,_#eef2ff_100%)] px-2 py-3 text-slate-700 sm:px-4 sm:py-6">
      <div className="mx-auto flex h-[668px] max-h-[calc(100vh-1rem)] w-[340px] max-w-[calc(100vw-1rem)] flex-col gap-4 rounded-[36px] border border-violet-200/70 bg-white/90 p-2 shadow-[0_16px_50px_rgba(109,40,217,0.12)] backdrop-blur-xl sm:w-[360px] sm:max-w-[calc(100vw-2rem)]">
        <div className="mx-auto mb-1 h-1.5 w-20 rounded-full bg-violet-200/80" />
        <section className="flex flex-1 flex-col overflow-hidden rounded-[24px] border border-violet-100 bg-[#fcfbff]">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-violet-100 p-5">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-violet-700">
                StellarX Console
              </p>
            </div>
            <div className="shrink-0">
              <ConnectWallet {...wallet} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {!publicKey && !connecting && (
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-center shadow-[0_1px_0_rgba(15,23,42,0.03)]">
                <p className="mb-2 text-sm font-semibold text-slate-900">
                  Connect your Freighter wallet to begin.
                </p>
                <p className="text-sm text-slate-600">
                  No wallet?{' '}
                  <a
                    href="https://freighter.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-violet-700 transition hover:text-violet-800"
                  >
                    Install Freighter
                  </a>{' '}
                  and switch it to Test Net.
                </p>
              </div>
            )}

            {publicKey && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-violet-50/70 p-4 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
                  <div className="mb-3 flex items-center justify-between gap-2 border-b border-violet-100 pb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-violet-700">
                      Wallet actions
                    </p>
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    <FundAccount publicKey={publicKey} onFunded={refresh} />
                    <AddTrustline publicKey={publicKey} onDone={refresh} />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
                  <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-violet-700">
                      Network
                    </p>
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-medium text-slate-800">Testnet · Stellar</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Secure and lightweight by design.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
                  <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-violet-700">
                      Balance overview
                    </p>
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
                  </div>
                  <div className="mt-3 space-y-3">
                    <BalanceCard publicKey={publicKey} refreshKey={refreshKey} />
                    <div className="flex items-center justify-between gap-2 px-1 py-1">
                      <button
                        onClick={refresh}
                        className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-left text-sm font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-50"
                      >
                        Refresh balance
                      </button>
                      <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                        Live view
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
                  <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-violet-700">
                      Send payment
                    </p>
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
                  </div>
                  <div className="mt-3">
                    <SendPayment publicKey={publicKey} onSent={refresh} />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-violet-700">
                  Savings goal
                </p>
                <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
              </div>
              <SavingsGoal publicKey={publicKey} />
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
