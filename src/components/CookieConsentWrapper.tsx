'use client';

import CookieConsentBanner from './CookieConsentBanner';
import { useRouter } from 'next/navigation';

export default function CookieConsentWrapper() {
  const router = useRouter();

  const handleAccept = () => {
    console.log('Cookies accepted');
    // You can add analytics tracking here
    // Example: enableAnalytics();
  };

  const handleDecline = () => {
    console.log('Cookies declined');
    // You can disable analytics here
    // Example: disableAnalytics();
  };

  const handleCustomize = () => {
    console.log('Cookie customization requested');
    // Redirect to cookies page with a specific section for cookie settings
    router.push('/cookies?section=manage');
  };

  return (
    <CookieConsentBanner
      onAccept={handleAccept}
      onDecline={handleDecline}
      onCustomize={handleCustomize}
    />
  );
} 