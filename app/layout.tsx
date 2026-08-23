import type { Metadata } from 'next'
import './globals.css'
import FloatingTenders from './components/FloatingTenders'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://tenders-agent.vercel.app'

export const metadata: Metadata = {
    metadataBase: new URL(SITE),
    title: {
        default: 'שווה מכרזים | כל המכרזים הציבוריים בישראל, מעודכן יומית',
        template: '%s',
    },
    description: 'מנוע מכרזים חכם — כל המכרזים הציבוריים בישראל במקום אחד: מינהל הרכש הממשלתי, רשויות מקומיות וגופים ציבוריים, עם התאמה אישית לעסק שלך.',
    alternates: { canonical: SITE },
    openGraph: {
        siteName: 'שווה מכרזים',
        locale: 'he_IL',
        type: 'website',
        url: SITE,
    },
}

// SEO: זהות הארגון והאתר עבור מנועי חיפוש
const ORG_JSONLD = {
    '@context': 'https://schema.org',
    '@graph': [
        { '@type': 'Organization', name: 'שווה מכרזים', url: SITE, description: 'גילוי מכרזים ציבוריים בישראל — שירות של מועדון עסקים 360' },
        { '@type': 'WebSite', name: 'שווה מכרזים', url: SITE, inLanguage: 'he' },
    ],
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="he" dir="rtl">
            <body>
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }} />
                {children}
                <FloatingTenders />
                <style>{`
@media (max-width: 768px) {
    [style*="flex: 0 0 238px"],
    [style*="flex:0 0 238px"] {
        display: none !important;
    }
    .inner-page-content {
        padding: 14px 14px 32px !important;
    }
    .inner-card {
        padding: 18px 14px !important;
    }
    .detail-grid {
        grid-template-columns: 1fr !important;
    }
    .tender-title {
        font-size: 1.15rem !important;
    }
    .docs-grid {
        grid-template-columns: 1fr !important;
    }
    .tender-actions {
        flex-direction: column !important;
    }
    .btn-primary, .btn-secondary {
        text-align: center !important;
    }
    .nav-row {
        display: none !important;
    }
}
`}</style>
            </body>
        </html>
    )
}
