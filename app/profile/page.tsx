'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InternalShell from '../components/InternalShell';
import { getSession } from '../lib/authClient';
import { fetchMyProfile, saveMyProfile } from '../lib/profileApi';
import { CATEGORY_OPTIONS, PUBLISHER_OPTIONS } from '../lib/domains';

const DARK = '#1a2330';
const BLUE = '#2b6fc4';
const MUTED = '#7a8794';

// הקטגוריות והמפרסמים נגזרים מהמנוע המרכזי (app/lib/domains.ts) —
// זהים אחד-לאחד לתחומי המכרזים בדשבורד.
const BIZ = CATEGORY_OPTIONS;

const REGS = [
  { value: 'all', label: 'כל הארץ' },
  { value: 'national', label: 'ארצי / ממשלתי' },
  { value: 'north', label: 'צפון' },
  { value: 'haifa', label: 'חיפה' },
  { value: 'center', label: 'מרכז' },
  { value: 'tlv', label: 'תל אביב' },
  { value: 'south', label: 'דרום' },
  { value: 'jerusalem', label: 'ירושלים' },
];

const PUBS = PUBLISHER_OPTIONS;

const selStyle = {
  width: '100%',
  padding: '11px 14px',
  paddingLeft: 28,
  borderRadius: 9,
  border: '1px solid #e2e7ec',
  background: '#f4f6f8',
  color: DARK,
  fontSize: 13.5,
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
  fontFamily: 'inherit',
};

export default function ProfilePage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [biz, setBiz] = useState<string[]>([]);
  const [reg, setReg] = useState('all');
  const [pub, setPub] = useState('all');
  const [otherText, setOtherText] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [initial, setInitial] = useState('');

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace('/signin');
      return;
    }
    setChecked(true);
    (async () => {
      try {
        const profile = await fetchMyProfile();
        if (profile) {
          setBiz(profile.categories || []);
          setReg(profile.region || 'all');
          setPub(profile.publisher_type || 'all');
          setOtherText(profile.category_other || '');
          setInitial(
            JSON.stringify({
              biz: profile.categories || [],
              reg: profile.region || 'all',
              pub: profile.publisher_type || 'all',
              otherText: profile.category_other || '',
            })
          );
        } else {
          setInitial(JSON.stringify({ biz: [], reg: 'all', pub: 'all', otherText: '' }));
        }
      } catch {
        setError('טעינת הפרופיל נכשלה');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const toggleBiz = (value: string) => {
    setBiz((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
    setSaved(false);
  };

  const current = JSON.stringify({ biz, reg, pub, otherText });
  const dirty = current !== initial;

  const save = async () => {
    setError('');
    try {
      await saveMyProfile({
        categories: biz,
        category_other: biz.includes('other') ? otherText : null,
        region: reg,
        publisher_type: pub,
      });
      setInitial(current);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err?.message || 'שמירת הפרופיל נכשלה');
    }
  };

  const labelFor = (value: string) => {
    if (value === 'other') {
      return otherText.trim() ? otherText.trim() : 'אחר';
    }
    return BIZ.find((b) => b.value === value)?.label || value;
  };

  let statusBg = '#f5efdc';
  let statusFg = '#8a6d1f';
  let statusBorder = '#e8ddbf';
  let statusText = 'לא נבחר סוג עסק — יוצגו כל המכרזים';
  if (biz.length === 1) {
    statusText = 'נבחרה קטגוריה אחת — מכרזים יסוננו לפי ' + labelFor(biz[0]);
  } else if (biz.length > 1) {
    statusBg = '#e8f1fb';
    statusFg = '#1e5aa8';
    statusBorder = '#cfe0f4';
    statusText = 'נבחרו ' + biz.length + ' קטגוריות';
  }

  if (!checked || loading) return null;

  return (
    <InternalShell
      title="הגדרת פרופיל עסקי"
      subtitle="הפרופיל קובע אילו מכרזים יותאמו ויוצגו לכם"
      action={
        <button
          onClick={save}
          disabled={!dirty || saved}
          style={{
            padding: '9px 18px',
            borderRadius: 10,
            border: 'none',
            background: BLUE,
            color: '#fff',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: dirty ? 'pointer' : 'default',
            opacity: dirty || saved ? 1 : 0.6,
          }}
        >
          {saved ? 'נשמר ✓' : 'שמירת פרופיל'}
        </button>
      }
    >
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 26px 32px', background: '#f6f8fa' }}>
        <div style={{ background: '#fff', border: '1px solid #e6eaee', borderRadius: 12, padding: 20, marginBottom: 18 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: DARK, marginBottom: 4 }}>סוג העסק שלי</div>
          <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 16 }}>
            בחרו קטגוריה אחת או יותר — היא תקבע אילו מכרזים יוצגו לכם
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {BIZ.map((b) => {
              const active = biz.includes(b.value);
              return (
                <button
                  key={b.value}
                  onClick={() => toggleBiz(b.value)}
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
                  {b.label}
                </button>
              );
            })}
          </div>
          {biz.includes('other') && (
            <div style={{ marginTop: 14 }}>
              <input
                type="text"
                value={otherText}
                onChange={(e) => {
                  setOtherText(e.target.value);
                  setSaved(false);
                }}
                placeholder="תארו את תחום העיסוק שלכם"
                style={{
                  width: '100%',
                  maxWidth: 420,
                  padding: '10px 14px',
                  borderRadius: 9,
                  border: '1px solid #e2e7ec',
                  background: '#f4f6f8',
                  color: DARK,
                  fontSize: 13.5,
                  fontFamily: 'inherit',
                }}
              />
            </div>
          )}
          <div
            style={{
              marginTop: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 9,
              background: statusBg,
              color: statusFg,
              border: '1px solid ' + statusBorder,
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusFg, display: 'inline-block' }} />
            {statusText}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
          <div style={{ background: '#fff', border: '1px solid #e6eaee', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: DARK, marginBottom: 4 }}>אזור גאוגרפי</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 14 }}>פילטר משני — מצמצם לפי מיקום הפעילות</div>
            <div style={{ position: 'relative' }}>
              <select
                value={reg}
                onChange={(e) => {
                  setReg(e.target.value);
                  setSaved(false);
                }}
                style={selStyle}
              >
                {REGS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#9aa6b2', pointerEvents: 'none' }}>
                ▾
              </span>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e6eaee', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: DARK, marginBottom: 4 }}>סוג מפרסם</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 14 }}>פילטר משני — משרדי ממשלה, רשויות, חברות</div>
            <div style={{ position: 'relative' }}>
              <select
                value={pub}
                onChange={(e) => {
                  setPub(e.target.value);
                  setSaved(false);
                }}
                style={selStyle}
              >
                {PUBS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#9aa6b2', pointerEvents: 'none' }}>
                ▾
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ color: '#b04a34', fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        <div
          style={{
            background: '#f0f6fd',
            border: '1px solid #cfe0f4',
            borderRadius: 10,
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: BLUE,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              flexShrink: 0,
            }}
          >
            ✦
          </div>
          <div style={{ fontSize: 13, color: DARK, lineHeight: 1.5 }}>
            הסוכן החכם משתמש בפרופיל העסקי הזה כדי להתאים אישית את המכרזים המוצגים לכם, לדרג אותם לפי רלוונטיות ולחשב ציון התאמה לכל מכרז.
          </div>
        </div>
      </div>
    </InternalShell>
  );
}
