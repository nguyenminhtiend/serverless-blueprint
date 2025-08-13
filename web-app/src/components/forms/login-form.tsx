'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Shield, ArrowRight } from 'lucide-react';

import { PrimaryOAuthButton } from '@/components/auth/oauth-login-button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface LoginFormProps {
  redirectTo?: string;
  className?: string;
}

/**
 * Maps OAuth error codes to user-friendly messages
 */
function getErrorMessage(error: string): string {
  const errorMessages: Record<string, string> = {
    access_denied: 'You cancelled the sign-in process. Please try again.',
    invalid_request: 'There was an issue with the sign-in request. Please try again.',
    unauthorized_client:
      'Authentication service is temporarily unavailable. Please try again later.',
    unsupported_response_type: 'Authentication configuration error. Please contact support.',
    invalid_scope: 'Authentication scope error. Please contact support.',
    server_error: 'Authentication server error. Please try again later.',
    temporarily_unavailable:
      'Authentication service is temporarily unavailable. Please try again later.',
    missing_parameters: 'Authentication parameters missing. Please try again.',
    invalid_session: 'Your session has expired. Please try again.',
    session_expired: 'Your authentication session has expired. Please try again.',
    invalid_state: 'Authentication security check failed. Please try again.',
    callback_failed: 'Authentication process failed. Please try again.',
    missing_pkce_session: 'Authentication session not found. Please try again.',
    invalid_pkce_session: 'Authentication session is invalid. Please try again.',
  };

  return errorMessages[error] || 'An error occurred during sign-in. Please try again.';
}

export function LoginForm({ redirectTo = '/dashboard', className }: LoginFormProps) {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');

  return (
    <div className={className}>
      <div className="flex flex-col space-y-3 text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-2">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Welcome back</h1>
        <p className="text-base text-gray-600 max-w-sm mx-auto">
          Sign in securely through AWS Cognito to access your dashboard
        </p>
      </div>

      <div className="space-y-6">
        {error && (
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{getErrorMessage(error)}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <PrimaryOAuthButton returnTo={redirectTo} />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Secure authentication powered by</span>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <Shield className="w-4 h-4" />
            <span>AWS Cognito</span>
            <ArrowRight className="w-4 h-4" />
            <span>OAuth 2.0 + PKCE</span>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-600">
          Need an account?{' '}
          <Link
            href="/register"
            className="font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200"
          >
            Sign up for free
          </Link>
        </p>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start space-x-2">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Enhanced Security</p>
            <p className="text-blue-700">
              Your credentials are never stored in our application. Authentication is handled
              securely by AWS Cognito using industry-standard OAuth 2.0 with PKCE.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
