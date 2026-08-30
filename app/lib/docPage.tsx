// עמוד מסמך ציבורי משותף — /privacy, /terms, /accessibility.
// נטען שרת-צד מהמאגר; כשאין עדיין תוכן שמור מוצג טקסט ביניים בעברית
// (בלי המילה placeholder — ממצא QA 29.08.2026).
import { getDocument, DOCUMENT_TITLES } from './ops';
import { renderDocMarkdown } from './docMarkdown';

export const FALLBACK_MD: Record<string, string> = {
  privacy: 'התוכן המלא של מדיניות הפרטיות יפורסם כאן בקרוב. לשאלות בנושא פרטיות אפשר לפנות אלינו בכתובת המייל שבתחתית האתר.',
  terms: 'התוכן המלא של תנאי השימוש יפורסם כאן בקרוב. לשאלות אפשר לפנות אלינו בכתובת המייל שבתחתית האתר.',
  accessibility: 'הצהרת הנגישות המלאה תפורסם כאן בקרוב. אנחנו פועלים להנגשת האתר לכלל המשתמשים.',
};

export async function DocPage({ slug }: { slug: 'privacy' | 'terms' | 'accessibility' }) {
  const doc = await getDocument(slug);
  const title = doc?.title || DOCUMENT_TITLES[slug];
  const md = doc?.content_md?.trim() || FALLBACK_MD[slug];
  const updated = doc?.updated_at ? new Date(doc.updated_at) : null;
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f6f8fa',
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
          maxWidth: 720,
          height: 'fit-content',
          background: '#fff',
          border: '1px solid #e6eaee',
          borderRadius: 14,
          padding: 32,
          color: '#1a2330',
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{title}</h1>
        {updated && !isNaN(updated.getTime()) && (
          <div style={{ fontSize: 12, color: '#8a97a3', marginBottom: 18 }}>
            עודכן לאחרונה: {updated.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </div>
        )}
        <div style={{ marginTop: updated ? 0 : 14 }}>{renderDocMarkdown(md)}</div>
      </div>
    </div>
  );
}
