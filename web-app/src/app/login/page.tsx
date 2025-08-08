'use client';

import { useSearchParams } from 'next/navigation';
import { PublicRoute } from '@/components/auth/protected-route';
import { LoginForm } from '@/components/forms/login-form';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirect') || '/dashboard';

  return (
    <PublicRoute redirectTo={redirectTo}>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg w-full">
          <div className="bg-white p-10 rounded-2xl shadow-2xl border border-gray-200">
            <LoginForm redirectTo={redirectTo} />
          </div>
        </div>
      </div>
    </PublicRoute>
  );
}
