'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '../lib/authClient';
import { saveMyProfile } from '../lib/profileApi';
import { CATEGORY_OPTIONS } from '../lib/domains';

const DARK = '#1a2330';
const BLUE = '#2b6fc4';
const MUTED = '#7a8794';

// כל 12 תחומי המכרזים + "אחר" — מאותו מקור אמת של הדשבורד.
const CATS = CATEGORY_OPTIONS;

const STEPS = [
  { n: 1, label: 'יצירת חשבון' },
  { n: 2, label: 'פרופיל עסקי' },
  { n: 3, label: 'התאמת מכרזים' },
];

function Stepper({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 26 }}>
      {STEPS.map((s, i) => {
        const done = s.n < step;
        const active = s.n === step;
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  background: done ? '#e8f1fb' : active ? BLUE : '#fff',
                  color: done ? '#1e5aa8' : active ? '#fff' : '#8a97a3',
                  border: done ? '1.5px solid ' + BLUE : active ? 'none' : '1px solid #e2e7ec',
                }}
              >
                {done ? '✓' : s.n}
              </div>
              <div style={{ fontSize: 11.5, fontWeight: active ? 700 : 500, color: active ? DARK : MUTED }}>
                {s.label}
              </div>
            </div>
            {i < STEPS.length - 1 && <div style={{ width: 38, height: 1, background: '#e2e7ec', margin: '0 8px', alignSelf: 'flex-start', marginTop: 13 }} />}
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [step, setStep] = useState(2);
  const [categories, setCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace('/signin');
      return;
    }
    setChecked(true);
  }, [router]);

  function toggle(value: string) {
    setCategories((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function handleContinue() {
    setError('');
    setSaving(true);
    try {
      await saveMyProfile({
        categories,
        category_other: null,
        region: 'all',
        publisher_type: 'all',
      });
      setStep(3);
    } catch (err: any) {
      setError(err?.message || 'שמירת הפרופיל נכשלה');
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    router.push('/dashboard');
  }

  if (!checked) return null;

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
        padding: '48px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          height: 'fit-content',
          background: '#fff',
          border: '1px solid #e6eaee',
          borderRadius: 14,
          padding: 32,
        }}
      >
        <Stepper step={step} />

        {step === 2 && (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: DARK, textAlign: 'center', marginBottom: 6 }}>
              במה העסק שלכם עוסק?
            </div>
            <div style={{ fontSize: 13, color: MUTED, textAlign: 'center', marginBottom: 22 }}>
              בחרו קטגוריה אחת או יותר — נתאים לכם מכרזים וציוני התאמה
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 9, marginBottom: 20 }}>
              {CATS.map((c) => {
                const active = categories.includes(c.value);
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggle(c.value)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 999,
                      border: active ? '1.5px solid ' + BLUE : '1px solid #e2e7ec',
                      background: active ? '#e8f1fb' : '#fff',
                      color: active ? '#1e5aa8' : '#5b6b7a',
                      fontWeight: active ? 700 : 600,
                      fontSize: 13.5,
                      cursor: 'pointer',
                    }}
                  >
                    {active ? '✓ ' : ''}
                    {c.label}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                background: '#f0f6fd',
                border: '1px solid #cfe0f4',
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 22,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: BLUE,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                ✦
              </div>
              <div style={{ fontSize: 12.5, color: DARK, lineHeight: 1.5 }}>
                הסוכן החכם ישתמש בבחירה כדי לחשב ציון התאמה לכל מכרז — אפשר לשנות בכל רגע בפרופיל העסקי.
              </div>
            </div>

            {error && <div style={{ color: '#b04a34', fontSize: 12.5, marginBottom: 14, textAlign: 'center' }}>{error}</div>}

            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleSkip}
                style={{ background: 'none', border: 'none', color: MUTED, fontSize: 13, cursor: 'pointer', padding: 0 }}
              >
                דלגו בינתיים
              </button>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={handleContinue}
                disabled={saving}
                style={{
                  padding: '12px 28px',
                  borderRadius: 9,
                  border: 'none',
                  background: BLUE,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'שומר…' : 'המשך ←'}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#e8f1fb',
                color: '#1e5aa8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                margin: '0 auto 18px',
              }}
            >
              ✓
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: DARK, marginBottom: 10 }}>הפרופיל נשמר בהצלחה!</div>
            <div style={{ fontSize: 13.5, color: MUTED, marginBottom: 26, lineHeight: 1.6 }}>
              מעכשיו הסוכן החכם יתאים אישית את המכרזים המוצגים לכם ויחשב ציון התאמה לכל מכרז, על סמך תחום העיסוק שבחרתם.
            </div>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              style={{
                padding: '13px 32px',
                borderRadius: 9,
                border: 'none',
                background: BLUE,
                color: '#fff',
                fontSize: 14.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              לדשבורד
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
