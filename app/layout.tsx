import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'שווה מכרזים | נתונים חיים ממינהל הרכש הממשלתי',
  description: 'מנוע מכרזים חכם – עדכון יומי מנמ"ר ומינהל הרכש הממשלתי',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
