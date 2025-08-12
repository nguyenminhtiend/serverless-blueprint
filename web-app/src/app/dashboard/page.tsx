'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, signOut } = useAuthContext();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
        <nav className="bg-white shadow-lg border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600 font-medium">Welcome, {user?.firstName}!</span>
                <Button variant="outline" onClick={handleSignOut} className="hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors">
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-6">
                <h2 className="text-3xl font-bold text-white mb-2">
                  🎉 Welcome to Your Dashboard!
                </h2>
                <p className="text-blue-100">
                  You have successfully signed in and reached the protected dashboard.
                </p>
              </div>

              <div className="p-8">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl shadow-inner mb-8">
                  <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    User Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                      <label className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Email:</label>
                      <p className="text-gray-900 font-medium mt-1">{user?.email}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                      <label className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Name:</label>
                      <p className="text-gray-900 font-medium mt-1">
                        {user?.firstName} {user?.lastName}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                      <label className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Email Verified:</label>
                      <p className={`font-bold mt-1 ${user?.emailVerified ? 'text-green-600' : 'text-red-600'}`}>
                        {user?.emailVerified ? '✅ Verified' : '❌ Not Verified'}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                      <label className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Token Expires:</label>
                      <p className="text-gray-900 font-medium mt-1">
                        {user?.expiresAt ? new Date(user.expiresAt).toLocaleString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    What's Next?
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl shadow-sm border border-blue-200 hover:shadow-md transition-shadow">
                      <div className="flex items-center mb-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                          <span className="text-white font-bold text-sm">3</span>
                        </div>
                        <h4 className="font-bold text-blue-900">API Integration</h4>
                      </div>
                      <p className="text-blue-800 text-sm leading-relaxed">
                        Connect to your serverless backend APIs with proper authentication and secure data handling.
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl shadow-sm border border-green-200 hover:shadow-md transition-shadow">
                      <div className="flex items-center mb-3">
                        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                          <span className="text-white font-bold text-sm">4</span>
                        </div>
                        <h4 className="font-bold text-green-900">Order Management</h4>
                      </div>
                      <p className="text-green-800 text-sm leading-relaxed">
                        Build comprehensive order creation forms and lookup functionality with real-time updates.
                      </p>
                    </div>
                  </div>

                  <div className="flex space-x-4 justify-center mt-8 pt-6 border-t border-gray-200">
                    <Button asChild className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all">
                      <Link href="/orders/new">Create Order</Link>
                    </Button>
                    <Button variant="outline" asChild className="border-2 border-gray-300 hover:border-gray-400 font-semibold px-6 py-2.5 rounded-lg transition-all">
                      <Link href="/">Home</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
