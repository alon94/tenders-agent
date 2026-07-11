'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { completeOAuthSession } from '../../lib/authClient';
import { fetchMyProfile } from '../../lib/profileApi';

const DARK = '#1a2330';
const BLUE = '#2b6fc4';
const MUTED = '#7a8794';
const ERROR = '#b04a34';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const session = await completeOAuthSession();
        if (!session) {
          router.replace('/signin');
          return;
        }
        const profile = await fetchMyProfile();
        router.replace(profile ? '/dashboard' : '/onboarding');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ההתחברות נכשלה');
      }
    })();
  }, [router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f6f8fa',
        direction: 'rtl',
        fontFamily: "'Heebo', Arial, sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#fff',
          border: '1px solid #e6eaee',
          borderRadius: 14,
          padding: 32,
          textAlign: 'center',
        }}
      >
        {error ? (
          <>
            <div style={{ color: ERROR, fontSize: 14, marginBottom: 14 }}>{error}</div>
            <a href="/signin" style={{ color: BLUE, fontWeight: 700, textDecoration: 'none', fontSize: 13.5 }}>
              חזרה להתחברות
            </a>
          </>
        ) : (
          <div style={{ color: MUTED, fontSize: 14 }}>מתחברים…</div>
        )}
      </div>
    </div>
  );
}
