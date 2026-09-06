'use client';
// /mt/new — בדיקת תנאי סף ופתיחת טיוטה חדשה; האשף עצמו ב-/mt/[id]/edit
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import InternalShell from '../../components/InternalShell';
import { MtClientError, errMessage, mtFetch } from '../../lib/mt/client';
import { Btn, C, Card, Row, SignInPrompt, Spinner, useSession } from '../ui';

function MtNewInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { session, ready } = useSession();
  const [err, setErr] = useState<{ code: string; message: string } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ready || !session || started.current) return;
    started.current = true;
    mtFetch<{ id: string }>('/', { method: 'POST', body: {} })
      .then((r) => {
        // מקור: מכרז ציבורי (כפתור «צריך קבלן משנה») — נעביר כהינט לאשף
        const from = params.get('from');
        router.replace(`/mt/${r.id}/edit${from ? `?from=${encodeURIComponent(from)}` : ''}`);
      })
      .catch((e) => setErr({ code: e instanceof MtClientError ? e.code : 'error', message: errMessage(e) }));
  }, [ready, session, router, params]);

  return (
    <InternalShell title="מיני־מכרז חדש" subtitle="פותחים טיוטה…">
      <div style={{ padding: 22, maxWidth: 640 }}>
        {!ready ? <Spinner /> : !session ? <SignInPrompt next="/mt/new" /> : !err ? <Spinner label="פותחים טיוטה חדשה…" /> : (
          <Card>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 8 }}>
              {err.code === 'forbidden' ? 'לפני שמתחילים — נשלים את הפרופיל העסקי' : err.code === 'conflict' || /3 מיני/.test(err.message) ? 'הגעתם למכסת המיני־מכרזים הפעילים' : 'לא הצלחנו לפתוח טיוטה'}
            </div>
            <div style={{ color: C.muted, fontSize: '0.875rem', lineHeight: 1.6, marginBottom: 16 }}>{err.message}</div>
            <Row>
              {err.code === 'forbidden'
                ? <Btn href="/profile">להשלמת הפרופיל העסקי</Btn>
                : <Btn href="/mt">למיני־מכרזים שלי</Btn>}
              <Btn href="/mt" kind="secondary">חזרה</Btn>
            </Row>
          </Card>
        )}
      </div>
    </InternalShell>
  );
}

// useSearchParams דורש גבול Suspense בזמן build
export default function MtNew() {
  return <Suspense fallback={null}><MtNewInner /></Suspense>;
}
