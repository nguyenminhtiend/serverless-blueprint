/**
 * OAuth login button component
 * Handles redirect to Cognito Hosted UI
 */

'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/components/providers/auth-provider';

interface OAuthLoginButtonProps {
  returnTo?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  children?: React.ReactNode;
}

export function OAuthLoginButton({
  returnTo = '/dashboard',
  className,
  variant = 'default',
  size = 'default',
  children,
}: OAuthLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, loading } = useAuthContext();

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      await signIn(returnTo);
    } catch (error) {
      console.error('Login failed:', error);
      setIsLoading(false);
    }
  };

  const isDisabled = loading || isLoading;

  return (
    <Button
      onClick={handleLogin}
      disabled={isDisabled}
      variant={variant}
      size={size}
      className={className}
    >
      {isDisabled && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children || (isDisabled ? 'Signing in...' : 'Sign in with AWS Cognito')}
    </Button>
  );
}

/**
 * Primary OAuth login button with AWS branding
 */
export function PrimaryOAuthButton({
  returnTo = '/dashboard',
  className = '',
}: {
  returnTo?: string;
  className?: string;
}) {
  return (
    <OAuthLoginButton
      returnTo={returnTo}
      className={`w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 ${className}`}
    >
      <div className="flex items-center justify-center">
        <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        Sign in with AWS Cognito
      </div>
    </OAuthLoginButton>
  );
}

/**
 * Compact OAuth login button
 */
export function CompactOAuthButton({
  returnTo = '/dashboard',
  className = '',
}: {
  returnTo?: string;
  className?: string;
}) {
  return (
    <OAuthLoginButton
      returnTo={returnTo}
      variant="outline"
      className={`border-gray-300 hover:bg-gray-50 ${className}`}
    >
      <div className="flex items-center justify-center">
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        Sign in
      </div>
    </OAuthLoginButton>
  );
}
