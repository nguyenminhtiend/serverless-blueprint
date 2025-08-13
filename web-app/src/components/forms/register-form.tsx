'use client';

import Link from 'next/link';
import { Shield, UserPlus, ArrowRight, CheckCircle } from 'lucide-react';

import { PrimaryOAuthButton } from '@/components/auth/oauth-login-button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RegisterFormProps {
  className?: string;
}

export function RegisterForm({ className }: RegisterFormProps) {
  return (
    <div className={className}>
      <div className="flex flex-col space-y-3 text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-2xl flex items-center justify-center mb-2">
          <UserPlus className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Create your account</h1>
        <p className="text-base text-gray-600 max-w-sm mx-auto">
          Sign up securely through AWS Cognito to get started
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <PrimaryOAuthButton returnTo="/dashboard">
            <div className="flex items-center justify-center">
              <UserPlus className="mr-3 h-5 w-5" />
              Sign up with AWS Cognito
            </div>
          </PrimaryOAuthButton>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Secure registration powered by</span>
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
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200"
          >
            Sign in instead
          </Link>
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-start space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-medium mb-1">What happens when you sign up?</p>
              <p className="text-green-700">
                You'll be redirected to AWS Cognito's secure registration page where you can create
                your account with email verification and password requirements.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start space-x-2">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Enhanced Security</p>
              <p className="text-blue-700">
                Your account information is securely managed by AWS Cognito with enterprise-grade
                security features including MFA support, password policies, and fraud detection.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
