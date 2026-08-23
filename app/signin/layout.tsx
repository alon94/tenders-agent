import type { Metadata } from 'next';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://tenders-agent.vercel.app';
export const metadata: Metadata = {
  title: 'התחברות | שווה מכרזים',
  description: 'התחברות לשווה מכרזים — גילוי מכרזים ציבוריים מותאם אישית לעסק שלך.',
  alternates: { canonical: `${SITE}/signin` },
};
export default function SigninLayout({ children }: { children: React.ReactNode }) { return children; }
