import type { MetadataRoute } from 'next';

// QA/M-12: רק העמודים הציבוריים. עמודי מכרז בודדים אינם נכללים —
// הם משתנים יומית ומספרם בסדר גודל של אלפים.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://tenders-agent.vercel.app';
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/dashboard`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/sources`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/guarantee`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/signin`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
