import type { Metadata } from 'next';
import { getTenderById } from '../../lib/db';
import TenderClient from './TenderClient';

// SEO: העמוד עצמו הפך לרכיב שרת — metadata ייחודי + JSON-LD לכל מכרז,
// בעוד שהממשק האינטראקטיבי נשאר ברכיב הלקוח (TenderClient).

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://tenders-agent.vercel.app';

function fmtHe(d?: string | null): string {
  if (!d) return '';
  const x = new Date(String(d).split('T')[0]);
  return isNaN(x.getTime()) ? '' : x.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function loadTender(id: string) {
  // כשל רשת ≠ מכרז לא קיים — במקרה כשל מוותרים על metadata ייחודי בלבד
  try { return await getTenderById(id); } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = await loadTender(id);
  if (!t) {
    return { title: 'מכרז | שווה מכרזים', robots: { index: false } };
  }
  const deadline = fmtHe(t.deadline as string | null);
  const published = fmtHe(t.publish_date as string | null);
  const title = `${t.title} — ${t.publisher || 'מכרז ציבורי'}`;
  const description = [
    t.title,
    t.publisher ? `גוף מפרסם: ${t.publisher}` : '',
    published ? `פורסם ${published}` : '',
    deadline ? `מועד הגשה אחרון ${deadline}` : '',
    'כל הפרטים, המסמכים ולוח הזמנים בשווה מכרזים.',
  ].filter(Boolean).join(' · ').slice(0, 300);
  return {
    title: `${title} | שווה מכרזים`.slice(0, 120),
    description,
    alternates: { canonical: `${SITE}/tender/${id}` },
    openGraph: {
      title,
      description,
      url: `${SITE}/tender/${id}`,
      siteName: 'שווה מכרזים',
      locale: 'he_IL',
      type: 'article',
    },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await loadTender(id);
  const jsonLd = t ? {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t.title,
    url: `${SITE}/tender/${id}`,
    inLanguage: 'he',
    datePublished: t.publish_date ? String(t.publish_date).split('T')[0] : undefined,
    expires: t.deadline ? String(t.deadline).split('T')[0] : undefined,
    publisher: { '@type': 'Organization', name: 'שווה מכרזים', url: SITE },
    about: {
      '@type': 'GovernmentService',
      name: t.title,
      provider: t.publisher ? { '@type': 'GovernmentOrganization', name: t.publisher } : undefined,
    },
  } : null;
  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <TenderClient id={id} />
    </>
  );
}
