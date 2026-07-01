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
                <a href="/dashboard" className="back-link">{"← חזרה לרשימת המכרזים"}</a>
                {children}
            </div>
        </div>
    );

    if (loading) return shell(
        <div className="inner-card center-text">
            <div>טוען פרטי מכרז...</div>
        </div>
    );
    if (error || !tender) return shell(
        <div className="inner-card center-text error-text">{error || 'מכרז לא נמצא'}</div>
    );

    const row = (label: string, value?: string) => value ? (
        <div className="detail-row">
            <span className="detail-label">{label}</span>
            <span className="detail-value">{value}</span>
        </div>
    ) : null;

    return shell(
        <div className="inner-card">
            <div className="tender-header">
                {tender.status && <span className="status-badge">{tender.status}</span>}
                <span className="tender-title">{tender.title || 'מכרז'}</span>
                {tender.publisher && <div className="tender-publisher">{tender.publisher}</div>}
            </div>
            <div className="detail-grid">
                {row('מסי פרסום', tender.publicationNumber)}
                {row('מסי הליך', tender.procedureNumber)}
                {row('תאריך פרסום', tender.publishDate)}
                {row('תאריך עדכון', tender.updateDate)}
                {row('מועד תחילת ההגשה', tender.submissionStart)}
                {row('מועד אחרון להגשה', tender.deadline)}
                {row('פנייה למפרסם', tender.contactName)}
                {row('דואל', tender.contactEmail)}
            </div>
            {tender.topics && tender.topics.length > 0 && (
                <div className="section-block">
                    <h2 className="section-title">נושאים</h2>
                    <div className="tags-row">
                        {tender.topics.map((t) => <span key={t} className="topic-tag">{t}</span>)}
                    </div>
                </div>
            )}
            {tender.documents && tender.documents.length > 0 && (
                <div className="section-block">
                    <h2 className="section-title">מסמכים נלווים</h2>
                    <div className="docs-grid">
                        {tender.documents.map((doc) => (
                            <a key={doc.url} href={doc.url} target="_blank" rel="noopener noreferrer" className="doc-card">
                                {doc.date && <span className="doc-date">{doc.date}</span>}
                                <span className="doc-title">{doc.title}</span>
                                {doc.description && <span className="doc-desc">{doc.description}</span>}
                                <span className="doc-icon" aria-hidden="true">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
                                    </svg>
                                </span>
                            </a>
                        ))}
                    </div>
                </div>
            )}
            <div className="tender-actions">
                {tender.submissionUrl && (
                    <a href={tender.submissionUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                        להגשת הצעה
                    </a>
                )}
                {tender.url && (
                    <a href={tender.url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                        צפייה במקור (mr.gov.il) ↗
                    </a>
                )}
            </div>
        </div>
    );
}
