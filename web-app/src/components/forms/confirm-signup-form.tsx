'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { confirmSignUpSchema, type ConfirmSignUpFormData } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConfirmSignUpFormProps {
  className?: string;
}

export function ConfirmSignUpForm({ className }: ConfirmSignUpFormProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const { confirmSignUp, loading, error } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const form = useForm<ConfirmSignUpFormData>({
    resolver: zodResolver(confirmSignUpSchema),
    defaultValues: {
      email: emailParam,
      confirmationCode: '',
    },
  });

  const onSubmit = async (data: ConfirmSignUpFormData) => {
    try {
      await confirmSignUp(data.email, data.confirmationCode);
      setIsConfirmed(true);
    } catch (error) {
      // Error is handled by the useAuth hook
    }
  };

  if (isConfirmed) {
    return (
      <div className={className}>
        <div className="flex flex-col space-y-4 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
          <h1 className="text-2xl font-semibold tracking-tight">Email confirmed!</h1>
          <p className="text-sm text-muted-foreground">
            Your email has been successfully confirmed. You can now sign in to your account.
          </p>
          <Button onClick={() => router.push('/login')} className="w-full">
            Sign in to your account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-col space-y-2 text-center mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Confirm your email</h1>
        <p className="text-sm text-muted-foreground">
          Enter the confirmation code sent to your email address
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            disabled={loading}
            {...form.register('email')}
          />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmationCode">Confirmation Code</Label>
          <Input
            id="confirmationCode"
            type="text"
            placeholder="123456"
            maxLength={6}
            disabled={loading}
            {...form.register('confirmationCode')}
            onChange={(e) => {
              // Only allow numbers
              const value = e.target.value.replace(/\D/g, '');
              e.target.value = value;
              form.setValue('confirmationCode', value);
            }}
          />
          {form.formState.errors.confirmationCode && (
            <p className="text-sm text-destructive">
              {form.formState.errors.confirmationCode.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirm Email
        </Button>
      </form>

      <div className="mt-6 text-center text-sm">
        <p className="text-muted-foreground">
          Didn't receive the code?{' '}
          <Button
            variant="link"
            className="p-0 h-auto font-normal"
            onClick={() => {
              // TODO: Implement resend confirmation code
              console.log('Resend confirmation code');
            }}
          >
            Resend code
          </Button>
        </p>
      </div>
    </div>
  );
}
