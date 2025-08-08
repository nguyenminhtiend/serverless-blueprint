'use client'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuthContext } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function DashboardPage() {
  const { user, signOut } = useAuthContext()

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold">Dashboard</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  Welcome, {user?.firstName}!
                </span>
                <Button variant="outline" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  🎉 Authentication Working!
                </h2>
                <p className="text-gray-600 mb-6">
                  You have successfully signed in and reached the protected dashboard.
                </p>

                <div className="bg-white p-6 rounded-lg shadow mb-6">
                  <h3 className="text-lg font-semibold mb-4">User Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    <div>
                      <label className="font-medium text-gray-700">Email:</label>
                      <p className="text-gray-900">{user?.email}</p>
                    </div>
                    <div>
                      <label className="font-medium text-gray-700">Name:</label>
                      <p className="text-gray-900">{user?.firstName} {user?.lastName}</p>
                    </div>
                    <div>
                      <label className="font-medium text-gray-700">Email Verified:</label>
                      <p className={user?.emailVerified ? 'text-green-600' : 'text-red-600'}>
                        {user?.emailVerified ? 'Yes' : 'No'}
                      </p>
                    </div>
                    <div>
                      <label className="font-medium text-gray-700">Token Expires:</label>
                      <p className="text-gray-900">
                        {user?.expiresAt ? new Date(user.expiresAt).toLocaleString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">What's Next?</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-blue-900 mb-2">Phase 3: API Integration</h4>
                      <p className="text-blue-700 text-sm">
                        Connect to your serverless backend APIs with proper authentication.
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-green-900 mb-2">Phase 4: Order Management</h4>
                      <p className="text-green-700 text-sm">
                        Build order creation forms and lookup functionality.
                      </p>
                    </div>
                  </div>

                  <div className="flex space-x-4 justify-center mt-6">
                    <Button asChild>
                      <Link href="/orders/new">Create Order</Link>
                    </Button>
                    <Button variant="outline" asChild>
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
  )
}