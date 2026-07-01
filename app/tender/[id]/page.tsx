'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import SiteNav from '../../components/SiteNav';

const NAVY="#0b2e52",BLUE="#2e86de",MUTED="#64778a";
const RBK="Rubik,'Assistant',Arial,sans-serif";

interface TenderDetail {
  id: string; title?: string; publisher?: string; publicationNumber?: string; status?: string;
  procedureNumber?: string; publishDate?: string; updateDate?: string; submissionStart?: string;
  deadline?: string; contactName?: string; contactEmail?: string; topics?: string[];
  documents?: { date?: string; title: string; description?: string; url: string }[];
  submissionUrl?: string; url?: string;
}

export default function TenderPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [tender, setTender] = useState<TenderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/tender/${id}`)
      .then((r) => { if (!r.ok) throw new Error('failed'); return r.json(); })
      .then((data) => { setTender(data); setLoading(false); })
      .catch(() => { setError('לא ניתן לטעון את פרטי המכרז'); setLoading(false); });
  }, [id]);

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: '#e9f3fc', fontFamily: "'Assistant',Arial,sans-serif", direction: 'rtl', color: NAVY }}>
      <SiteNav active="/dashboard" />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 16px 40px' }}>
        <a href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: BLUE, textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 18 }}>← חזרה לרשימת המכרזים</a>
        {children}
      </div>
    </div>
  );

  if (loading) return shell(<div style={{ background: '#fff', borderRadius: 20, padding: 40, textAlign: 'center', color: MUTED, boxShadow: '0 10px 28px rgba(11,46,82,.05)' }}>טוען פרטי מכרז...</div>);
  if (error || !tender) return shell(<div style={{ background: '#fff', borderRadius: 20, padding: 40, textAlign: 'center', color: '#e0463c', boxShadow: '0 10px 28px rgba(11,46,82,.05)' }}>{error || 'מכרז לא נמצא'}</div>);

  const row = (label: string, value?: string) => value ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 0', borderBottom: '1px solid #eef4fa' }}>
      <span style={{ fontSize: 12.5, color: MUTED, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 15, color: '#33475b', fontWeight: 600 }}>{value}</span>
    </div>
  ) : null;

  return shell(
    <div style={{ background: '#fff', borderRadius: 22, padding: '28px 30px', boxShadow: '0 10px 28px rgba(11,46,82,.05)' }}>
      <div style={{ marginBottom: 22 }}>
        {tender.status && <span style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 700, padding: '5px 12px', borderRadius: 999, background: '#fcf2d0', color: '#b78a18', marginBottom: 12 }}>{tender.status}</span>}
        <h1 style={{ fontFamily: RBK, fontSize: 26, fontWeight: 700, color: NAVY, lineHeight: 1.35, margin: '0 0 8px' }}>{tender.title || 'מכרז'}</h1>
        {tender.publisher && <p style={{ margin: 0, fontSize: 15, color: BLUE, fontWeight: 600 }}>{tender.publisher}</p>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0 32px', marginBottom: 8 }}>
        {row('מס׳ פרסום', tender.publicationNumber)}
        {row('מס׳ הליך', tender.procedureNumber)}
        {row('תאריך פרסום', tender.publishDate)}
        {row('תאריך עדכון', tender.updateDate)}
        {row('מועד תחילת ההגשה', tender.submissionStart)}
        {row('מועד אחרון להגשה', tender.deadline)}
        {row('פנייה למפרסם', tender.contactName)}
        {row('דוא״ל', tender.contactEmail)}
      </div>

      {tender.topics && tender.topics.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontFamily: RBK, fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 12 }}>נושאים</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {tender.topics.map((t, i) => (<span key={i} style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 13px', borderRadius: 999, background: '#e1effb', color: '#1f73c4' }}>{t}</span>))}
          </div>
        </div>
      )}

      {tender.documents && tender.documents.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontFamily: RBK, fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 12 }}>מסמכים נלווים</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
            {tender.documents.map((d, i) => (
              <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '16px 18px', borderRadius: 14, background: '#f2f7fc', border: '1px solid #e2ecf6', textDecoration: 'none', color: NAVY, position: 'relative' }}>
                {d.date && <span style={{ fontSize: 11.5, color: MUTED }}>{d.date}</span>}
                <span style={{ fontSize: 14.5, fontWeight: 600, color: NAVY }}>{d.title}</span>
                {d.description && <span style={{ fontSize: 12.5, color: MUTED }}>{d.description}</span>}
                <span style={{ position: 'absolute', bottom: 14, left: 16, color: BLUE }} aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
        {tender.submissionUrl && <a href={tender.submissionUrl} target="_blank" rel="noopener noreferrer" style={{ background: NAVY, color: '#fff', textDecoration: 'none', borderRadius: 12, padding: '13px 26px', fontSize: 15, fontWeight: 700, fontFamily: RBK }}>להגשת הצעה</a>}
        {tender.url && <a href={tender.url} target="_blank" rel="noopener noreferrer" style={{ background: '#fff', color: '#33475b', textDecoration: 'none', borderRadius: 12, padding: '13px 26px', fontSize: 15, fontWeight: 600, border: '1px solid #e2ecf6' }}>צפייה במקור (mr.gov.il) ↗</a>}
      </div>
    </div>
  );
}
