'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type EmployeeRole = 'ADMIN' | 'EMPLOYEE';
export type EmployeeStatus = 'INVITED' | 'ACTIVE' | 'WALLET_CONNECTED';

export interface SessionEmployee {
  id: string;
  email: string;
  fullName: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  companyId: string;
  stellarWallet: string | null;
}

interface AuthContextValue {
  employee: SessionEmployee | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  acceptInvite: (token: string, password: string) => Promise<void>;
  connectWallet: (stellarWallet: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseErrorOr<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Request failed.' }));
    throw new Error(error || 'Request failed.');
  }
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<SessionEmployee | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me'); // cookie sent automatically
      if (!res.ok) {
        setEmployee(null);
        return;
      }
      const { employee: me } = await res.json();
      setEmployee(me);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const { employee: me } = await parseErrorOr<{ employee: SessionEmployee }>(res);
    setEmployee(me);
  }, []);

  const acceptInvite = useCallback(async (token: string, password: string) => {
    const res = await fetch('/api/auth/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const { employee: me } = await parseErrorOr<{ employee: SessionEmployee }>(res);
    setEmployee(me);
  }, []);

  const connectWallet = useCallback(async (stellarWallet: string) => {
    const res = await fetch('/api/auth/me/wallet', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stellarWallet }),
    });
    const data = await parseErrorOr<{ stellarWallet: string; status: EmployeeStatus }>(res);
    setEmployee((prev) =>
      prev ? { ...prev, stellarWallet: data.stellarWallet, status: data.status } : prev
    );
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setEmployee(null);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <AuthContext.Provider
      value={{ employee, loading, login, acceptInvite, connectWallet, logout, refetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
