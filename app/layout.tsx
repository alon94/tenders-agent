import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'שווה מכרזים | נתונים חיים ממינהל הרכש הממשלתי',
    description: 'מנוע מכרזים חכם — עדכון יומי מנח"ר ומינהל הרכש הממשלתי',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="he" dir="rtl">
            <body>
                {children}
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
