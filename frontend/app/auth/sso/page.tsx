'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Image from 'next/image';

export default function SSOPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const status = searchParams.get('status');
    const token = searchParams.get('token');
    const errorMessage = searchParams.get('message');

    // Scenario 1: Third-party sends user directly with token
    if (token && !status) {
      setMessage('Verifying your credentials...');
      setState('loading');

      // Call backend SSO API and wait for response
      const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      fetch(`${backendUrl}/auth/sso?token=${token}`, {
        method: 'GET',
        credentials: 'include', // Important: include cookies
      })
        .then(async (response) => {
          if (response.ok) {
            // Success - cookies should be set by backend
            setState('success');
            setMessage('Authentication successful! Redirecting to dashboard...');

            // Start countdown
            const interval = setInterval(() => {
              setCountdown((prev) => {
                if (prev <= 1) {
                  clearInterval(interval);
                  router.push('/hr');
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
          } else {
            // Error response from backend
            const data = await response.json().catch(() => ({ message: 'Authentication failed' }));
            setState('error');
            setMessage(data.message || 'Authentication failed. Please try again.');
          }
        })
        .catch((error) => {
          console.error('SSO API call failed:', error);
          setState('error');
          setMessage('Failed to connect to authentication server. Please try again.');
        });

      return;
    }

    // Scenario 2: Backend redirected with status=success
    if (status === 'success') {
      // Verify cookies are set
      const hasAccessToken = document.cookie.includes('accessToken=');
      const hasUser = document.cookie.includes('user=');

      if (hasAccessToken && hasUser) {
        setState('success');
        setMessage('Authentication successful! Redirecting to dashboard...');

        // Start countdown
        const interval = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              router.push('/hr');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        return () => clearInterval(interval);
      } else {
        setState('error');
        setMessage('Authentication cookies not found. Please try again.');
      }
    } else if (status === 'error') {
      // Scenario 3: Backend redirected with status=error
      setState('error');
      setMessage(errorMessage || 'Authentication failed. Please try again.');
    } else if (!token) {
      // Scenario 4: Direct access without parameters
      setState('error');
      setMessage('No authentication credentials provided. Please use the proper SSO link.');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1 text-center pb-4">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              {state === 'loading' && (
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              )}
              {state === 'success' && (
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              )}
              {state === 'error' && (
                <XCircle className="h-6 w-6 text-destructive" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {state === 'loading' && 'Verifying Authentication'}
              {state === 'success' && 'Login Successful!'}
              {state === 'error' && 'Authentication Failed'}
            </CardTitle>
            <CardDescription>
              {state === 'loading' && 'Please wait while we verify your credentials...'}
              {state === 'success' && 'You have been successfully authenticated'}
              {state === 'error' && 'Unable to complete authentication'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Loading State */}
            {state === 'loading' && (
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  <p className="text-sm">Securing your session...</p>
                </div>
              </div>
            )}

            {/* Success State */}
            {state === 'success' && (
              <div className="space-y-4">
                <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-800 dark:text-green-300">
                    {message}
                  </AlertDescription>
                </Alert>

                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">
                    Redirecting in
                  </p>
                  <p className="text-3xl font-bold text-primary tabular-nums">
                    {countdown}
                  </p>
                </div>

                <Button
                  onClick={() => router.push('/hr')}
                  className="w-full"
                  size="lg"
                >
                  Go to Dashboard Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Error State */}
            {state === 'error' && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    {message}
                  </AlertDescription>
                </Alert>

                <Alert className="bg-muted/50 border-border">
                  <AlertDescription className="text-sm text-muted-foreground">
                    If this problem persists, please contact your system administrator.
                  </AlertDescription>
                </Alert>

                <div className="flex flex-col gap-3 pt-2">
                  <Button
                    onClick={() => window.location.href = '/auth/login'}
                    className="w-full"
                    size="lg"
                  >
                    Go to Login Page
                  </Button>
                  <Button
                    onClick={() => window.history.back()}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    Go Back
                  </Button>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-4 pt-6 border-t border-border/50">
            <div className="w-full">
              <div className="flex items-center justify-center gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Powered by
                </p>
                <div className="flex items-center gap-1.5">
                  <Image
                    src="/logo.png"
                    alt="Innovative Network Logo"
                    width={20}
                    height={20}
                    className="object-contain"
                  />
                  <span className="text-sm font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                    Innovative Network Pvt Ltd
                  </span>
                </div>
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
