'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthRegisterRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the correct signup page
    router.replace('/authentication/signup');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lockr-cyan mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to signup page...</p>
      </div>
    </div>
  );
} 