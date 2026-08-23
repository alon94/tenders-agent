import type { Metadata } from 'next';
// עמוד אישי — מחוץ לאינדוקס (וגם חסום ב-robots.txt)
export const metadata: Metadata = { title: 'מכרזים מסומנים | שווה מכרזים', robots: { index: false } };
export default function MarkedLayout({ children }: { children: React.ReactNode }) { return children; }
