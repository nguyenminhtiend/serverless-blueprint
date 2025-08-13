/**
 * OAuth callback page
 * Handles the redirect from Cognito Hosted UI after authentication
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for OAuth errors in URL params
        const oauthError = searchParams.get('error');
        if (oauthError) {
          const errorDescription = searchParams.get('error_description');
          setError(errorDescription || oauthError);
          setStatus('error');
          return;
        }

        // Check for required parameters
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code || !state) {
          setError('Missing authorization code or state parameter');
          setStatus('error');
          return;
        }

        // The OAuth callback API route handles the actual token exchange
        // This page is just for displaying loading/success/error states
        // since the API route will redirect automatically on success

        setStatus('success');

        // Small delay to show success state before potential redirect
        setTimeout(() => {
          // If we're still here after a moment, something went wrong
          // This shouldn't normally happen as the API route should redirect
          if (window.location.pathname === '/auth/callback') {
            setError('OAuth callback processing failed - redirecting to login');
            setStatus('error');
            setTimeout(() => {
              router.push('/login');
            }, 2000);
          }
        }, 3000);
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError('An unexpected error occurred during authentication');
        setStatus('error');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Completing Sign In...
            </h1>
            <p className="text-gray-600">
              Please wait while we securely process your authentication.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="text-center">
            <div className="rounded-full h-12 w-12 bg-green-100 mx-auto mb-4 flex items-center justify-center">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Sign In Successful!
            </h1>
            <p className="text-gray-600">
              You have been successfully authenticated. Redirecting...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-auto p-6">
        <div className="text-center">
          <div className="rounded-full h-12 w-12 bg-red-100 mx-auto mb-4 flex items-center justify-center">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Sign In Failed
          </h1>
          <p className="text-gray-600 mb-4">
            {error || 'An error occurred during authentication.'}
          </p>
          <button
            onClick={() => router.push('/login')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
