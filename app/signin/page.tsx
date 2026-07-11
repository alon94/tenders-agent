'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn, recoverPassword, signInWithGoogle } from '../lib/authClient';
import { fetchMyProfile } from '../lib/profileApi';

const DARK = '#1a2330';
const BLUE = '#2b6fc4';
const MUTED = '#7a8794';
const ERROR = '#b04a34';

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 9,
  border: '1px solid #e2e7ec',
  background: '#f4f6f8',
  color: DARK,
  fontSize: 13.5,
  fontFamily: 'inherit',
  boxSizing: 'border-box' as const,
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

export default function SigninPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await signIn(email, password);
      const profile = await fetchMyProfile();
      router.push(profile ? '/dashboard' : '/onboarding');
    } catch (err: any) {
      setError(err?.message || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError('');
    setInfo('');
    if (!email) {
      setError('הזינו קודם את כתובת האימייל שלכם בשדה למעלה');
      return;
    }
    setRecovering(true);
    try {
      await recoverPassword(email);
      setInfo('אם קיים חשבון עם כתובת אימייל זו, נשלח אליו קישור לאיפוס סיסמה.');
    } catch (err: any) {
      setError(err?.message || 'שליחת מייל האיפוס נכשלה');
    } finally {
      setRecovering(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f6f8fa',
        backgroundImage: 'linear-gradient(180deg, #e8f1fb, transparent 180px)',
        direction: 'rtl',
        fontFamily: "'Heebo', Arial, sans-serif",
        display: 'flex',
        justifyContent: 'center',
        padding: '60px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          height: 'fit-content',
          background: '#fff',
          border: '1px solid #e6eaee',
          borderRadius: 14,
          padding: 32,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 11,
              background: BLUE,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 18,
              marginBottom: 14,
            }}
          >
            ש
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: DARK, textAlign: 'center' }}>
            התחברות לשווה מכרזים
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 6, textAlign: 'center' }}>
            מועדון עסקים 360 · גילוי מכרזים מותאם אישית
          </div>
        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 9,
            border: '1px solid #e2e7ec',
            background: '#fff',
            color: DARK,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <GoogleIcon />
          המשך עם Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#eef1f4' }} />
          <div style={{ fontSize: 12, color: MUTED }}>או עם אימייל</div>
          <div style={{ flex: 1, height: 1, background: '#eef1f4' }} />
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#5b6b7a', marginBottom: 6 }}>
              אימייל
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.co.il"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#5b6b7a' }}>סיסמה</label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={recovering}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: BLUE,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: recovering ? 'default' : 'pointer',
                }}
              >
                {recovering ? 'שולח…' : 'שכחתי סיסמה'}
              </button>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="הסיסמה שלכם"
              style={inputStyle}
            />
          </div>

          {error && <div style={{ color: ERROR, fontSize: 12.5, marginBottom: 14 }}>{error}</div>}
          {info && (
            <div
              style={{
                color: '#1e5aa8',
                fontSize: 13,
                marginBottom: 14,
                background: '#e8f1fb',
                border: '1px solid #cfe0f4',
                padding: '10px 12px',
                borderRadius: 9,
              }}
            >
              {info}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 13,
              borderRadius: 9,
              border: 'none',
              background: BLUE,
              color: '#fff',
              fontSize: 14.5,
              fontWeight: 700,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'מתחבר…' : 'התחברות'}
          </button>
        </form>

        <div style={{ marginTop: 18, fontSize: 13, color: MUTED, textAlign: 'center' }}>
          אין לכם חשבון?{' '}
          <Link href="/signup" style={{ color: BLUE, fontWeight: 700, textDecoration: 'none' }}>
            להרשמה
          </Link>
        </div>
      </div>
    </div>
  );
}
