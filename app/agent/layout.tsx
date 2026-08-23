import type { Metadata } from 'next';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://tenders-agent.vercel.app';
export const metadata: Metadata = {
  title: 'הסוכן החכם — מכרזים מותאמים לפרופיל העסקי | שווה מכרזים',
  description: 'סוכן חכם שסורק את כל המכרזים הציבוריים ומדרג התאמה לעסק שלך לפי תחום, אזור וניסיון.',
  alternates: { canonical: `${SITE}/agent` },
};
export default function AgentLayout({ children }: { children: React.ReactNode }) { return children; }
