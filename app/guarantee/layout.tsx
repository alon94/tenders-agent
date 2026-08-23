import type { Metadata } from 'next';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://tenders-agent.vercel.app';
export const metadata: Metadata = {
  title: 'ערבויות מכרז וליווי להגשה | שווה מכרזים',
  description: 'מידע על ערבויות בנקאיות למכרזים, לוחות זמנים וליווי מקצועי להגשת הצעות למכרזים ציבוריים.',
  alternates: { canonical: `${SITE}/guarantee` },
};
export default function GuaranteeLayout({ children }: { children: React.ReactNode }) { return children; }
