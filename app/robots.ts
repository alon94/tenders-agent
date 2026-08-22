import type { MetadataRoute } from 'next';

// QA/M-12: לא היו robots.txt ולא sitemap.xml — שניהם החזירו 404.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://tenders-agent.vercel.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // אזורים אישיים ותפעוליים — אין טעם שייסרקו
        disallow: ['/api/', '/admin', '/profile', '/marked', '/onboarding', '/auth/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
