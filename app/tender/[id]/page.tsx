'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

interface TenderDetail {
  id: string;
  title?: string;
  publisher?: string;
  publicationNumber?: string;
  status?: string;
  procedureNumber?: string;
  publishDate?: string;
  updateDate?: string;
  submissionStart?: string;
  deadline?: string;
  contactName?: string;
  contactEmail?: string;
  topics?: string[];
  documents?: { date?: string; title: string; description?: string; url: string }[];
  submissionUrl?: string;
  url?: string;
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
      .then((r) => {
        if (!r.ok) throw new Error('failed');
        return r.json();
      })
      .then((data) => {
        setTender(data);
        setLoading(false);
      })
      .catch(() => {
        setError('לא ניתן לטעון את פרטי המכרז');
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>טוען פרטי מכרז...</div>
      </div>
    );
  }

  if (error || !tender) {
    return (
      <div className={styles.container}>
        <Link href="/dashboard" className={styles.back}>← חזרה לרשימת המכרזים</Link>
        <div className={styles.error}>{error || 'מכרז לא נמצא'}</div>
      </div>
    );
  }

  const row = (label: string, value?: string) =>
    value ? (
      <div className={styles.row}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{value}</span>
      </div>
    ) : null;

  return (
    <div className={styles.container} dir="rtl">
      <Link href="/dashboard" className={styles.back}>← חזרה לרשימת המכרזים</Link>

      <div className={styles.card}>
        <div className={styles.header}>
          {tender.status && <span className={styles.status}>{tender.status}</span>}
          <h1 className={styles.title}>{tender.title || 'מכרז'}</h1>
          {tender.publisher && <p className={styles.publisher}>{tender.publisher}</p>}
        </div>

        <div className={styles.grid}>
          {row('מס׳ פרסום', tender.publicationNumber)}
          {row('מס׳ הליך', tender.procedureNumber)}
          {row('תאריך פרסום', tender.publishDate)}
          {row('תאריך עדכון', tender.updateDate)}
          {row('מועד תחילת ההגשה', tender.submissionStart)}
          {row('מועד אחרון להגשה', tender.deadline)}
          {row('פניה למפרסם', tender.contactName)}
          {row('דוא״ל', tender.contactEmail)}
        </div>

        {tender.topics && tender.topics.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>נושאים</h2>
            <div className={styles.tags}>
              {tender.topics.map((t, i) => (
                <span key={i} className={styles.tag}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {tender.documents && tender.documents.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>מסמכים נלווים</h2>
            <div className={styles.docsGrid}>
              {tender.documents.map((d, i) => (
                <a
                  key={i}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.docCard}
                >
                  {d.date && <span className={styles.docDate}>{d.date}</span>}
                  <span className={styles.docTitle}>{d.title}</span>
                  {d.description && (
                    <span className={styles.docDesc}>{d.description}</span>
                  )}
                  <span className={styles.docDownload} aria-hidden="true">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 3v12" />
                      <path d="m7 10 5 5 5-5" />
                      <path d="M5 21h14" />
                    </svg>
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className={styles.actions}>
          {tender.submissionUrl && (
            <a href={tender.submissionUrl} target="_blank" rel="noopener noreferrer" className={styles.primaryBtn}>
              להגשת הצעה
            </a>
          )}
          {tender.url && (
            <a href={tender.url} target="_blank" rel="noopener noreferrer" className={styles.secondaryBtn}>
              צפייה במקור (mr.gov.il)
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
