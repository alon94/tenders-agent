import { DocPage } from '../lib/docPage';

export const dynamic = 'force-dynamic';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://tenders-agent.vercel.app';
// SEO: canonical עצמי — בלי זה העמוד יורש את ה-canonical של דף הבית מה-layout הראשי
export const metadata = { title: 'הצהרת נגישות · שווה מכרזים', alternates: { canonical: `${SITE}/accessibility` } };

export default function AccessibilityPage() {
  return <DocPage slug="accessibility" />;
}
