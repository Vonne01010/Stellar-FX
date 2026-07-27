'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, EmployeeRole } from '../context/AuthContext';

// Wrap any client page: <ProtectedRoute roles={['ADMIN']}><Dashboard /></ProtectedRoute>
export function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: EmployeeRole[];
}) {
  const { employee, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!employee) {
      router.replace('/login');
      return;
    }
    if (roles && !roles.includes(employee.role)) {
      router.replace('/unauthorized');
    }
  }, [employee, loading, roles, router]);

  if (loading || !employee || (roles && !roles.includes(employee.role))) {
    return null;
  }

  return <>{children}</>;
}
