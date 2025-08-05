'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignInRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/authentication/signin');
  }, [router]);

  return null;
} 