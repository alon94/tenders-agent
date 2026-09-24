import type { Metadata } from 'next';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://tenders-agent.vercel.app';
export const metadata: Metadata = {
  title: 'הרשמה | שווה מכרזים',
  description: 'הרשמה לשווה מכרזים — גילוי מכרזים ציבוריים מותאם אישית לעסק שלך.',
  alternates: { canonical: `${SITE}/signup` },
};
export default function SignupLayout({ children }: { children: React.ReactNode }) { return children; }
