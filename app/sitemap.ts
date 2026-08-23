import type { MetadataRoute } from 'next';
import { fetchActiveTenders } from './lib/agentEngine';

// SEO: ה-sitemap כולל את כל דפי המכרז הפעילים (מקור התנועה האורגנית העיקרי),
// מתוך אותו מאגר-אמת שהאתר מגיש (fetchActiveTenders — cache עם רענון ברקע).
// מגבלת התקן היא 50,000 כתובות לקובץ; המאגר בסדר גודל של ~10,000.

export const revalidate = 3600; // שעה — אין צורך לחשב מחדש בכל בקשה

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://tenders-agent.vercel.app';
  const now = new Date();
  const fixed: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/dashboard`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/sources`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/guarantee`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/signin`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];
  try {
    const tenders = await fetchActiveTenders();
    const pages: MetadataRoute.Sitemap = tenders.slice(0, 45000).map((t) => ({
      url: `${base}/tender/${encodeURIComponent(t.id)}`,
      lastModified: (() => { const d = t.publish_date ? new Date(String(t.publish_date).split('T')[0]) : now; return isNaN(d.getTime()) ? now : d; })(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
    return [...fixed, ...pages];
  } catch {
    // כשל בטעינת המאגר לא מפיל את ה-sitemap — מגישים את הדפים הקבועים
    return fixed;
  }
}
