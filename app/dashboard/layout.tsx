import type { Metadata } from 'next';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://tenders-agent.vercel.app';
// SEO: metadata לעמוד לקוח — מיוצא מה-layout (רכיב שרת)
export const metadata: Metadata = {
  title: 'גילוי מכרזים — כל המכרזים הציבוריים בישראל | שווה מכרזים',
  description: 'חיפוש וסינון מכרזים ציבוריים לפי תחום, גוף מפרסם ומועד הגשה. עדכון יומי ממינהל הרכש הממשלתי, רשויות מקומיות וגופים ציבוריים.',
  alternates: { canonical: `${SITE}/dashboard` },
};
export default function DashboardLayout({ children }: { children: React.ReactNode }) { return children; }
