'use client'

import { useSearchParams } from 'next/navigation'
import { PublicRoute } from '@/components/auth/protected-route'
import { LoginForm } from '@/components/forms/login-form'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get('redirect') || '/dashboard'

  return (
    <PublicRoute redirectTo={redirectTo}>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <LoginForm redirectTo={redirectTo} />
          </div>
        </div>
      </div>
    </PublicRoute>
  )
}