import type { Metadata } from 'next';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://tenders-agent.vercel.app';
export const metadata: Metadata = {
  title: 'מקורות נתונים | שווה מכרזים',
  description: 'המקורות הרשמיים שמהם נאספים המכרזים: מינהל הרכש הממשלתי, נח"ר, רשות החדשנות, רשויות מקומיות ועוד — בעדכון יומי.',
  alternates: { canonical: `${SITE}/sources` },
};
export default function SourcesLayout({ children }: { children: React.ReactNode }) { return children; }
