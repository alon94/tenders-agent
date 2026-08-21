'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import InternalShell from '../../components/InternalShell';
import { BORDER, DARK, bandColor, scoreFor, statusTags, daysLeft, fmtDate, isExempt } from '../../lib/tenderMeta';
import { useIsMobile } from '../../hooks/useIsMobile';

interface Doc { name?: string; title?: string; type?: string; date?: string; url: string; description?: string }
interface TenderDetail {
  id: string; title?: string; publisher?: string; publicationNumber?: string; status?: string;
  procedureNumber?: string; publishDate?: string; updateDate?: string; submissionStart?: string;
  deadline?: string; type?: string; contactName?: string; contactEmail?: string; topics?: string[];
  documents?: Doc[]; submissionUrl?: string; url?: string;
}

// QA #02: הטאבים היו קישוט — כולם הציגו את "סקירה". עכשיו לכל טאב תוכן משלו.
const TABS = ['סקירה', 'דרישות סף', 'מסמכים', 'לוח זמנים'] as const;

const MUTED_TXT = '#62707e'; // QA #12: 5.0:1 על לבן (קודם #7a8794 — 3.67:1)
const LABEL_TXT = '#6b7785';

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: '#fff', border: '1px solid ' + BORDER, borderRadius: 14, padding: 18, ...style }}>{children}</div>;
}

function readMarked(): string[] {
  try { const m = JSON.parse(localStorage.getItem('markedTenders') || '[]'); return Array.isArray(m) ? m : []; } catch { return []; }
}

// QA #13: "חזרה" תמיד הוביל ל-/marked. עכשיו: היסטוריה אם יש, אחרת הדשבורד.
function goBack(e: React.MouseEvent) {
  e.preventDefault();
  if (typeof window !== 'undefined' && window.history.length > 1 && document.referrer && new URL(document.referrer).origin === window.location.origin) {
    window.history.back();
  } else {
    window.location.href = '/dashboard';
  }
}

export default function TenderPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const isMobile = useIsMobile();
  const [t, setT] = useState<TenderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<number>(0);
  const [marked, setMarked] = useState(() => typeof window !== 'undefined' && readMarked().includes(String((typeof location !== 'undefined' && location.pathname.split('/').pop()) || '')));
  const [toast, setToast] = useState('');
  const [summary, setSummary] = useState<string[] | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    if (!id) return;
    fetch('/api/tender/' + encodeURIComponent(id))
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.status === 404 || data?.error === 'not_found') { setNotFound(true); return; }
        if (data.error) { setError(String(data.error)); return; }
        setT(data);
        setLoadedAt(Date.now());
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { if (!toast) return; const h = setTimeout(() => setToast(''), 2200); return () => clearTimeout(h); }, [toast]);

  const d = t ? daysLeft(t.deadline || '') : null;
  const exempt = t ? isExempt(t.type, t.title) : false;
  // QA #04: אותו ציון כמו ברשימה ובסוכן — scoreFor עוטף את genericScore
  const score = useMemo(() => t ? scoreFor(t.title || '', t.publisher || '', t.publishDate || '', t.deadline || '') : 0, [t]);

  function toggleMark() {
    const cur = readMarked();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    try { localStorage.setItem('markedTenders', JSON.stringify(next)); } catch {}
    const now = next.includes(id);
    setMarked(now);
    setToast(now ? 'נשמר למעקב — מופיע ב"מכרזים מסומנים"' : 'הוסר מהמעקב');
  }

  // QA #02: "הפק סיכום החלטה" — סיכום דטרמיניסטי מנתוני המכרז (ללא LLM).
  function buildSummary() {
    if (!t) return;
    const lines: string[] = [];
    lines.push(`מפרסם: ${t.publisher || 'לא ידוע'}${t.publicationNumber ? ` · מס' ${t.publicationNumber}` : ''}`);
    if (exempt) lines.push('סוג ההליך: הודעת פטור / התקשרות — לא ניתן להגיש הצעה, אך אפשר לעקוב אחרי הספק הזוכה ולהגיש השגה במועד.');
    else if (d !== null) lines.push(d < 0 ? 'מועד ההגשה חלף.' : d <= 3 ? `נותרו ${d} ימים בלבד — נדרשת החלטה מיידית.` : d <= 14 ? `נותרו ${d} ימים — חלון הגשה סביר, מומלץ להתחיל היום.` : `נותרו ${d} ימים — יש זמן לבדיקת דרישות סף ואיסוף מסמכים.`);
    else lines.push('לא פורסם מועד הגשה — יש לוודא מול המפרסם.');
    const docs = t.documents || [];
    lines.push(docs.length ? `מצורפים ${docs.length} מסמכים — יש לקרוא את חוברת המכרז לפני ההחלטה.` : 'אין מסמכים מצורפים — דרישות הסף מופיעות רק באתר המקור.');
    if (t.contactName || t.contactEmail) lines.push(`איש קשר לשאלות הבהרה: ${[t.contactName, t.contactEmail].filter(Boolean).join(' · ')}`);
    lines.push(score >= 80 ? `ציון התאמה ${score} — התאמה גבוהה לפי תחום, דחיפות וטריות.` : score >= 65 ? `ציון התאמה ${score} — התאמה טובה; כדאי לבדוק דרישות ניסיון ומחזור.` : `ציון התאמה ${score} — התאמה חלקית; הגדרת פרופיל עסקי תדייק את הדירוג.`);
    setSummary(lines);
  }

  const backLink = <a href="/dashboard" onClick={goBack} style={{ color: '#5b6b7a', textDecoration: 'none', fontSize: 13 }}>→ חזרה</a>;

  if (loading) return <InternalShell title="פרטי מכרז" action={backLink}><div role="status" aria-live="polite" style={{ color: MUTED_TXT }}>{'טוען…'}</div></InternalShell>;
  if (notFound) return (
    <InternalShell title="פרטי מכרז" action={backLink}>
      <Card style={{ maxWidth: 560, textAlign: 'center', padding: 36 }}>
        <div style={{ fontSize: 40, color: '#c2ccd6', lineHeight: 1 }}>404</div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: DARK, margin: '12px 0 6px' }}>המכרז לא נמצא</h1>
        <div style={{ fontSize: 13.5, color: MUTED_TXT, marginBottom: 18 }}>ייתכן שהמזהה <code dir="ltr">{id}</code> שגוי, או שהמכרז הוסר מהמקור.</div>
        <a href="/dashboard" style={{ display: 'inline-block', background: DARK, color: '#fff', borderRadius: 9, padding: '9px 18px', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>חזרה לגילוי מכרזים</a>
      </Card>
    </InternalShell>
  );
  if (error || !t) return <InternalShell title="פרטי מכרז" action={backLink}><div style={{ color: '#b04a34' }}>לא הצלחנו לטעון את המכרז. <a href="" style={{ color: '#2b6fc4' }}>נסו שוב</a></div></InternalShell>;

  const tags = statusTags(t.status || '', d, undefined);
  const docs = t.documents || [];
  const topics = (t.topics || []).filter((x) => !/^נושאים$/.test(x));

  const meta: [string, string][] = [
    ['גוף מפרסם', t.publisher || '—'],
    ['מספר מכרז', t.publicationNumber || t.procedureNumber || '—'],
    ['תחום', topics.join(', ') || '—'],
    ['תאריך פרסום', fmtDate(t.publishDate || '')],
    ['עודכן', t.updateDate ? fmtDate(t.updateDate) : '—'],
    ['מועד אחרון', exempt ? 'פטור / הודעת התקשרות' : fmtDate(t.deadline || '')],
  ];

  const timeline: { label: string; date: string; state: 'past' | 'next' | 'future' | 'none' }[] = (() => {
    const now = loadedAt;
    const items = [
      { label: 'פרסום', date: t.publishDate || '' },
      { label: 'עדכון אחרון', date: t.updateDate || '' },
      { label: 'תחילת הגשה', date: t.submissionStart || '' },
      { label: exempt ? 'מועד להגשת השגות' : 'מועד אחרון להגשה', date: t.deadline || '' },
    ];
    let nextMarked = false;
    return items.map((it) => {
      if (!it.date) return { ...it, state: 'none' as const };
      const ms = new Date(it.date).getTime();
      if (isNaN(ms)) return { ...it, state: 'none' as const };
      if (ms < now) return { ...it, state: 'past' as const };
      if (!nextMarked) { nextMarked = true; return { ...it, state: 'next' as const }; }
      return { ...it, state: 'future' as const };
    });
  })();

  const tabPanel = (() => {
    if (tab === 0) return (
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px 24px', marginTop: 16 }}>
        {meta.map(([k, v], i) => (
          <div key={i}>
            <div style={{ fontSize: 11.5, color: LABEL_TXT, marginBottom: 2 }}>{k}</div>
            <div style={{ fontSize: 13.5, color: k === 'מועד אחרון' ? '#b04a34' : DARK, fontWeight: 600 }}>{v}</div>
          </div>
        ))}
      </div>
    );
    if (tab === 1) return (
      <div style={{ marginTop: 16, fontSize: 13.5, color: DARK, lineHeight: 1.6 }}>
        <p style={{ margin: 0, color: MUTED_TXT }}>
          דרישות הסף המלאות (ניסיון, מחזור כספי, אישורים וערבויות) מופיעות בחוברת המכרז באתר המקור. המערכת מציגה כאן את מה שחולץ מהפרסום:
        </p>
        <ul style={{ margin: '12px 0 0', paddingInlineStart: 20 }}>
          <li>סטטוס הפרסום: <b>{t.status || 'לא ידוע'}</b></li>
          <li>סוג ההליך: <b>{exempt ? 'הודעת פטור / התקשרות (ללא הגשת הצעה)' : (t.type || 'מכרז')}</b></li>
          {topics.length > 0 && <li>נושאים: <b>{topics.join(', ')}</b></li>}
          {(t.contactName || t.contactEmail) && <li>איש קשר לשאלות הבהרה: <b>{t.contactName || ''}</b>{t.contactEmail && <> · <a href={'mailto:' + t.contactEmail} style={{ color: '#2b6fc4' }}>{t.contactEmail}</a></>}</li>}
          <li>חוברת המכרז ודרישות הסף: <a href={t.submissionUrl || t.url || '#'} target="_blank" rel="noreferrer" style={{ color: '#2b6fc4', fontWeight: 600 }}>פתיחה באתר המקור ↗</a></li>
        </ul>
      </div>
    );
    if (tab === 2) return (
      <div style={{ marginTop: 16 }}>
        {docs.length === 0 ? (
          <div style={{ fontSize: 13, color: MUTED_TXT }}>לא נמצאו מסמכים מצורפים בפרסום. המסמכים זמינים לרוב רק באתר המקור — <a href={t.url || '#'} target="_blank" rel="noreferrer" style={{ color: '#2b6fc4' }}>לעמוד המכרז ↗</a></div>
        ) : docs.map((doc, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? '1px solid #eef1f4' : 'none' }}>
            <span aria-hidden="true" style={{ fontSize: 18, color: '#5b6b7a' }}>▤</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name || doc.title || 'מסמך'}</div>
              <div style={{ fontSize: 11.5, color: LABEL_TXT }}>{[doc.description, doc.type, doc.date && fmtDate(doc.date)].filter(Boolean).join(' · ')}</div>
            </div>
            <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#2b6fc4', fontWeight: 600, textDecoration: 'none', flex: '0 0 auto' }}>הורדה ↓</a>
          </div>
        ))}
      </div>
    );
    return (
      <ol style={{ listStyle: 'none', margin: '16px 0 0', padding: 0 }}>
        {timeline.map((it, i) => {
          const c = it.state === 'past' ? '#1e9e5a' : it.state === 'next' ? '#b04a34' : it.state === 'future' ? '#2b6fc4' : '#c2ccd6';
          return (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: i ? '1px solid #eef1f4' : 'none' }}>
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 999, background: c, flex: '0 0 auto' }} />
              <span style={{ flex: 1, fontSize: 13.5, color: DARK, fontWeight: it.state === 'next' ? 700 : 500 }}>{it.label}</span>
              <span style={{ fontSize: 13, color: it.state === 'none' ? LABEL_TXT : DARK, fontVariantNumeric: 'tabular-nums' }}>{it.state === 'none' ? 'לא פורסם' : fmtDate(it.date)}</span>
              {it.state === 'next' && d !== null && d >= 0 && <span style={{ fontSize: 12, color: '#b04a34' }}>נותרו {d} ימים</span>}
            </li>
          );
        })}
      </ol>
    );
  })();

  return (
    <InternalShell title="פרטי מכרז" subtitle={t.publisher || undefined} action={backLink}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div aria-label={`ציון התאמה ${score}`} style={{ width: 66, height: 66, borderRadius: 14, background: '#e8f1fb', border: '1px solid #cfe0f4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#1e5aa8', lineHeight: 1 }}>{score}</span>
                <span style={{ fontSize: 9.5, color: '#1e5aa8' }}>ציון התאמה</span>
                <span style={{ width: 30, height: 3, borderRadius: 2, background: bandColor(score), marginTop: 3 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {tags.map((g, gi) => (<span key={gi} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: g.bg, color: g.fg, border: '1px solid ' + g.bd }}>{g.label}</span>))}
                </div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: DARK, lineHeight: 1.4, margin: 0 }}>{t.title || 'ללא כותרת'}</h1>
              </div>
            </div>
            <div role="tablist" aria-label="מידע על המכרז" style={{ display: 'flex', gap: 20, borderBottom: '1px solid ' + BORDER, marginTop: 16, overflowX: 'auto' }}>
              {TABS.map((tb, i) => (
                <button key={i} role="tab" aria-selected={tab === i} id={`tab-${i}`} aria-controls={`panel-${i}`} onClick={() => setTab(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', fontSize: 13.5, fontFamily: 'inherit', whiteSpace: 'nowrap', fontWeight: tab === i ? 700 : 500, color: tab === i ? '#1e5aa8' : MUTED_TXT, borderBottom: tab === i ? '2px solid #2b6fc4' : '2px solid transparent' }}>
                  {tb}{i === 2 && docs.length > 0 ? ` (${docs.length})` : ''}
                </button>
              ))}
            </div>
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>{tabPanel}</div>
          </Card>

          {summary && (
            <Card style={{ background: '#f0f6fd', border: '1px solid #cfe0f4' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: '#1e5aa8' }}>✦ סיכום החלטה</div>
              <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 13.5, color: '#2a3a4c', lineHeight: 1.7 }}>
                {summary.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </Card>
          )}
        </div>

        <div style={{ flex: isMobile ? '1 1 100%' : '0 0 300px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div style={{ fontSize: 11.5, color: LABEL_TXT }}>מועד אחרון להגשה</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#b04a34', margin: '4px 0 2px' }}>{exempt ? 'פטור / הודעת התקשרות' : fmtDate(t.deadline || '')}</div>
            {d !== null && d >= 0 && !exempt && <div style={{ fontSize: 12.5, color: MUTED_TXT }}>נותרו {d} ימים</div>}
            {d !== null && d < 0 && !exempt && <div style={{ fontSize: 12.5, color: '#b04a34' }}>מועד ההגשה חלף</div>}
            <a href={t.submissionUrl || t.url || '#'} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', marginTop: 12, background: '#2b6fc4', color: '#fff', borderRadius: 10, padding: '11px', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>{exempt ? 'צפייה בהודעה במקור ↗' : 'הגשת הצעה ↗'}</a>
            <button type="button" onClick={toggleMark} aria-pressed={marked}
              style={{ display: 'block', width: '100%', marginTop: 8, background: marked ? '#fbf3d8' : '#fff', color: marked ? '#8a6d1f' : '#5b6b7a', border: '1px solid ' + (marked ? '#f0e3b0' : BORDER), borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {marked ? '★ במעקב — הסרה' : '☆ שמירה למעקב'}
            </button>
            {toast && <div role="status" aria-live="polite" style={{ marginTop: 8, fontSize: 12.5, color: '#1e7d45', background: '#e7f6ec', border: '1px solid #c6ead2', borderRadius: 8, padding: '7px 10px' }}>{toast}</div>}
          </Card>
          <Card style={{ background: '#f0f6fd', border: '1px solid #cfe0f4' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e5aa8', marginBottom: 6 }}>✦ תובנת הסוכן החכם</div>
            <div style={{ fontSize: 12.5, color: '#40566e', lineHeight: 1.5 }}>
              {exempt
                ? 'זו הודעת התקשרות בפטור ממכרז. אין כאן הצעה להגיש, אבל אפשר ללמוד מי הספק ובאיזה היקף — מודיעין עסקי לקראת המכרז הבא.'
                : d !== null && d >= 0 && d <= 7
                  ? `נותרו ${d} ימים בלבד. אם דרישות הסף מתאימות, זה הזמן להתחיל בהכנת ההצעה והערבות.`
                  : score >= 80
                    ? 'התאמה גבוהה לפי תחום, דחיפות וטריות. מומלץ לקרוא את חוברת המכרז ולבדוק תנאי ניסיון ומחזור.'
                    : 'ההתאמה מחושבת לפי תחום, דחיפות וטריות. הגדרת פרופיל עסקי (תחומים, אזור, מילות מפתח) תדייק את הציון.'}
            </div>
            <button type="button" onClick={buildSummary} style={{ marginTop: 10, background: '#2b6fc4', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✦ הפק סיכום החלטה</button>
          </Card>
        </div>
      </div>
    </InternalShell>
  );
}
