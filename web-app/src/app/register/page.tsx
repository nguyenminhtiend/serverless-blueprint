import { PublicRoute } from '@/components/auth/protected-route';
import { RegisterForm } from '@/components/forms/register-form';

export default function RegisterPage() {
  return (
    <PublicRoute>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg w-full">
          <div className="bg-white p-10 rounded-2xl shadow-2xl border border-gray-200">
            <RegisterForm />
          </div>
        </div>
      </div>
    </PublicRoute>
  );
}
