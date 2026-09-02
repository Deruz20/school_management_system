'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, AlertCircle } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const isUnauthorized =
    error.message?.includes('Not authenticated') ||
    error.message?.includes('Unauthorized') ||
    error.message?.includes('Account suspended') ||
    error.message?.includes('no branch access');

  const isForbidden =
    error.message?.includes('Missing permission') ||
    error.message?.includes('Access denied') ||
    error.message?.includes('Forbidden');

  useEffect(() => {
    if (isUnauthorized) {
      router.push('/login');
    }
  }, [isUnauthorized, router]);

  if (isUnauthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4 text-amber-600">
          <LogIn className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Authentication Required</h2>
        <p className="text-slate-600 mb-6 max-w-md">
          Your session is not active or has expired. Redirecting to login...
        </p>
        <button
          onClick={() => router.push('/login')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
        >
          Go to Login
        </button>
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4 text-amber-600">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied (403)</h2>
        <p className="text-slate-600 mb-2 max-w-md">
          Your current account role does not have permission to access this module.
        </p>
        <p className="text-xs font-mono bg-slate-100 text-slate-600 px-3 py-1.5 rounded mb-6 border border-slate-200">
          {error.message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm"
          >
            Switch to Admin Account
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h2>
      <p className="text-slate-600 mb-6 max-w-md">
        {error.message || 'An unexpected error occurred while loading this page.'}
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={() => router.push('/login')}
          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors"
        >
          Re-login
        </button>
      </div>
    </div>
  );
}
