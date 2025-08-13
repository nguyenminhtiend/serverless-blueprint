'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle, Shield, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConfirmSignUpFormProps {
  className?: string;
}

export function ConfirmSignUpForm({ className }: ConfirmSignUpFormProps) {
  const router = useRouter();

  return (
    <div className={className}>
      <div className="flex flex-col space-y-3 text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-2">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Email Confirmation Handled Securely
        </h1>
        <p className="text-base text-gray-600 max-w-md mx-auto">
          With our new OAuth authentication system, email confirmation is handled directly by AWS
          Cognito's secure hosted pages.
        </p>
      </div>

      <div className="space-y-6">
        <Alert className="border-blue-200 bg-blue-50">
          <CheckCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>No manual confirmation needed!</strong> When you sign up through our OAuth flow,
            email verification is handled automatically as part of the secure registration process.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-medium mb-1">How it works now:</p>
                <ol className="list-decimal list-inside space-y-1 text-green-700">
                  <li>Click "Sign up with AWS Cognito" on our registration page</li>
                  <li>Complete registration on AWS Cognito's secure hosted page</li>
                  <li>Confirm your email through the link sent by AWS</li>
                  <li>Return to our app and sign in automatically</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <Shield className="w-4 h-4" />
            <span>AWS Cognito</span>
            <ArrowRight className="w-4 h-4" />
            <span>Enhanced Security</span>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => router.push('/register')}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Go to Secure Registration
          </Button>

          <Button
            variant="outline"
            onClick={() => router.push('/login')}
            className="w-full h-12 text-base border-gray-300 hover:bg-gray-50"
          >
            Already have an account? Sign in
          </Button>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-start space-x-2">
          <Shield className="w-5 h-5 text-gray-600 mt-0.5" />
          <div className="text-sm text-gray-800">
            <p className="font-medium mb-1">Enhanced Security Benefits</p>
            <p className="text-gray-700">
              Our OAuth implementation eliminates the need for manual email confirmation codes,
              providing a more secure and user-friendly authentication experience powered by AWS
              Cognito.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
