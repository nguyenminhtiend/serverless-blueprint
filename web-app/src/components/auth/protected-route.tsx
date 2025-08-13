'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
  fallback?: ReactNode;
}

export function ProtectedRoute({ children, redirectTo = '/login', fallback }: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const currentPath = window.location.pathname;
      const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`;
      router.push(redirectUrl);
    }
  }, [isAuthenticated, loading, router, redirectTo]);

  if (loading) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
            <span className="text-gray-600">Loading...</span>
          </div>
        </div>
      )
    );
  }

  if (!isAuthenticated || !user) {
    return fallback || null;
  }

  return <>{children}</>;
}

interface PublicRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

export function PublicRoute({ children, redirectTo = '/dashboard' }: PublicRouteProps) {
  const { user, loading, isAuthenticated } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, user, loading, router, redirectTo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
          <span className="text-gray-600">Redirecting...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
