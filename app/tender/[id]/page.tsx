'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import InternalShell from '../../components/InternalShell';
import { BORDER, DARK, bandColor, scoreFor, statusTags, daysLeft, fmtDate , isExempt } from '../../lib/tenderMeta';

interface Doc { name?: string; title?: string; type?: string; date?: string; url: string; description?: string }
interface TenderDetail {
  id: string; title?: string; publisher?: string; publicationNumber?: string; status?: string;
  procedureNumber?: string; publishDate?: string; updateDate?: string; submissionStart?: string;
  deadline?: string; type?: string; contactName?: string; contactEmail?: string; topics?: string[];
  documents?: Doc[]; submissionUrl?: string; url?: string;
}

const TABS = ['סקירה', 'דרישות סף', 'מסמכים', 'לוח זמנים'];

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: '#fff', border: '1px solid ' + BORDER, borderRadius: 14, padding: 18, ...style }}>{children}</div>;
}

export default function TenderPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const [t, setT] = useState<TenderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!id) return;
    fetch('/api/tender/' + encodeURIComponent(id))
      .then((r) => r.json())
      .then((data) => { if (data.error) setError(String(data.error)); else setT(data); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <InternalShell title="פרטי מכרז"><div style={{ color: '#7a8794' }}>טוען\u2026</div></InternalShell>;
  if (error || !t) return <InternalShell title="פרטי מכרז"><div style={{ color: '#b04a34' }}>שגיאה בטעינת המכרז.</div></InternalShell>;

  const d = daysLeft(t.deadline || '');
  const score = scoreFor(t.title || '', t.publisher || '');
  const tags = statusTags(t.status || '', d, undefined);
  const docs = t.documents || [];

  const meta: [string, string][] = [
    ['גוף מפרסם', t.publisher || '\u2014'],
    ['מספר מכרז', t.publicationNumber || t.procedureNumber || '\u2014'],
    ['תחום', (t.topics && t.topics.join(', ')) || '\u2014'],
    ['תאריך פרסום', fmtDate(t.publishDate || '')],
    ['עודכן', fmtDate(t.updateDate || '')],
    ['מועד אחרון', isExempt(t.type) ? 'פטור ממכרז' : fmtDate(t.deadline || '')],
  ];

  return (
    <InternalShell title="פרטי מכרז" subtitle={t.publisher || undefined}
      action={<a href="/marked" style={{ color: '#5b6b7a', textDecoration: 'none', fontSize: 13 }}>→ חזרה</a>}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 66, height: 66, borderRadius: 14, background: '#e8f1fb', border: '1px solid #cfe0f4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#1e5aa8', lineHeight: 1 }}>{score}</span>
                <span style={{ fontSize: 9.5, color: '#1e5aa8' }}>ציון התאמה</span>
                <span style={{ width: 30, height: 3, borderRadius: 2, background: bandColor(score), marginTop: 3 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {tags.map((g, gi) => (<span key={gi} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: g.bg, color: g.fg, border: '1px solid ' + g.bd }}>{g.label}</span>))}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: DARK, lineHeight: 1.4 }}>{t.title || 'ללא כותרת'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid ' + BORDER, marginTop: 16 }}>
              {TABS.map((tb, i) => (
                <button key={i} onClick={() => setTab(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', fontSize: 13.5, fontWeight: tab === i ? 700 : 500, color: tab === i ? '#1e5aa8' : '#7a8794', borderBottom: tab === i ? '2px solid #2b6fc4' : '2px solid transparent' }}>{tb}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', marginTop: 16 }}>
              {meta.map(([k, v], i) => (
                <div key={i}>
                  <div style={{ fontSize: 11.5, color: '#8a97a3', marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 13.5, color: k === 'מועד אחרון' ? '#b04a34' : DARK, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: DARK }}>מסמכים מצורפים</div>
            {docs.length === 0 ? (
              <div style={{ fontSize: 13, color: '#7a8794' }}>אין מסמכים מצורפים.</div>
            ) : docs.map((doc, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? '1px solid #eef1f4' : 'none' }}>
                <span style={{ fontSize: 18, color: '#5b6b7a' }}>▤</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name || doc.title || 'מסמך'}</div>
                  <div style={{ fontSize: 11.5, color: '#8a97a3' }}>{[doc.type, doc.date && fmtDate(doc.date)].filter(Boolean).join(' \u00B7 ')}</div>
                </div>
                <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#2b6fc4', fontWeight: 600, textDecoration: 'none', flex: '0 0 auto' }}>הורדה ↓</a>
              </div>
            ))}
          </Card>
        </div>

        <div style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div style={{ fontSize: 11.5, color: '#8a97a3' }}>מועד אחרון להגשה</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#b04a34', margin: '4px 0 2px' }}>{isExempt(t.type) ? 'פטור ממכרז' : fmtDate(t.deadline || '')}</div>
            {d !== null && d >= 0 && <div style={{ fontSize: 12.5, color: '#7a8794' }}>נותרו {d} ימים</div>}
            <a href={t.submissionUrl || t.url || '#'} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', marginTop: 12, background: '#2b6fc4', color: '#fff', borderRadius: 10, padding: '11px', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>הגשת הצעה ↗</a>
            <button style={{ display: 'block', width: '100%', marginTop: 8, background: '#fff', color: '#5b6b7a', border: '1px solid ' + BORDER, borderRadius: 10, padding: '10px', fontSize: 13, cursor: 'pointer' }}>☆ שמירה למעקב</button>
          </Card>
          <Card style={{ background: '#f0f6fd', border: '1px solid #cfe0f4' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e5aa8', marginBottom: 6 }}>✦ תובנת הסוכן החכם</div>
            <div style={{ fontSize: 12.5, color: '#40566e', lineHeight: 1.5 }}>ציון ההתאמה למכרז זה הוא {score}. מומלץ לבדוק את דרישות הסף לפני הגשה.</div>
            <button style={{ marginTop: 10, background: '#2b6fc4', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>✦ הפק סיכום החלטה</button>
          </Card>
        </div>
      </div>
    </InternalShell>
  );
}
