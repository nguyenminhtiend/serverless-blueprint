import { PublicRoute } from '@/components/auth/protected-route'
import { RegisterForm } from '@/components/forms/register-form'

export default function RegisterPage() {
  return (
    <PublicRoute>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <RegisterForm />
          </div>
        </div>
      </div>
    </PublicRoute>
  )
}