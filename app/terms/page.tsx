import { DocPage } from '../lib/docPage';

export const dynamic = 'force-dynamic';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://tenders-agent.vercel.app';
// SEO: canonical עצמי — בלי זה העמוד יורש את ה-canonical של דף הבית מה-layout הראשי
export const metadata = { title: 'תנאי שימוש · שווה מכרזים', alternates: { canonical: `${SITE}/terms` } };

export default function TermsPage() {
  return <DocPage slug="terms" />;
}
