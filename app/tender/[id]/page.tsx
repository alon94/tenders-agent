'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import SiteNav from '../../components/SiteNav';

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
        <div className="inner-page-wrap">
              <SiteNav active="/dashboard" />
              <div className="inner-page-content">
                      <a href="/dashboard" className="back-link">← חזרה לרשימת המכרזים</a>a>
                {children}
              </div>div>
        </div>div>
      );
  
    if (loading) return shell(
          <div className="inner-card center-text">טוען פרטי מכרז...</div>div>
        );
    if (error || !tender) return shell(
          <div className="inner-card center-text error-text">{error || 'מכרז לא נמצא'}</div>div>
        );
  
    const row = (label: string, value?: string) => value ? (
          <div className="detail-row">
                <span className="detail-label">{label}</span>span>
                <span className="detail-value">{value}</span>span>
          </div>div>
        ) : null;
  
    return shell(
          <div className="inner-card">
                <div className="tender-header">
                  {tender.status && <span className="status-badge">{tender.status}</span>span>}
                        <h1 className="tender-title">{tender.title || 'מכרז'}</h1>h1>
                  {tender.publisher && <p className="tender-publisher">{tender.publisher}</p>p>}
                </div>div>
          
                <div className="detail-grid">
                  {row('מס\u05b3 פרסום', tender.publicationNumber)}
                  {row('מס\u05b3 הליך', tender.procedureNumber)}
                  {row('תאריך פרסום', tender.publishDate)}
                  {row('תאריך עדכון', tender.updateDate)}
                  {row('מועד תחילת ההגשה', tender.submissionStart)}
                  {row('מועד אחרון להגשה', tender.deadline)}
                  {row('פנייה למפרסם', tender.contactName)}
                  {row('דוא\u05b4\u05b4ל', tender.contactEmail)}
                </div>div>
          
            {tender.topics && tender.topics.length > 0 && (
                    <div className="section-block">
                              <h2 className="section-title">נושאים</h2>h2>
                              <div className="tags-row">
                                {tender.topics.map((t, i) => (
                                    <span key={i} className="topic-tag">{t}</span>span>
                                  ))}
                              </div>div>
                    </div>div>
                )}
          
            {tender.documents && tender.documents.length > 0 && (
                    <div className="section-block">
                              <h2 className="section-title">מסמכים נלווים</h2>h2>
                              <div className="docs-grid">
                                {tender.documents.map((d, i) => (
                                    <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" className="doc-card">
                                      {d.date && <span className="doc-date">{d.date}</span>span>}
                                                    <span className="doc-title">{d.title}</span>span>
                                      {d.description && <span className="doc-desc">{d.description}</span>span>}
                                                    <span className="doc-icon" aria-hidden="true">
                                                                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                          <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>
                                                                      </svg>svg>
                                                    </span>span>
                                    </a>a>
                                  ))}
                              </div>div>
                    </div>div>
                )}
          
                <div className="tender-actions">
                  {tender.submissionUrl && (
                      <a href={tender.submissionUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                                  להגשת הצעה
                      </a>a>
                        )}
                  {tender.url && (
                      <a href={tender.url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                                  צפייה במקור (mr.gov.il) ↗
                      </a>a>
                        )}
                </div>div>
          </div>div>
        );
}
</div>
