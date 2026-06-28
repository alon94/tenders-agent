import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  title: "שווה מכרזים | נתונים חיים ממינהל הרכש הממשלתי",
  description: "סריקה יומית של כל המכרזים הממשלתיים והמוניציפליים בישראל",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} font-heebo antialiased bg-gray-50`}>
        {children}
      </body>
    </html>
  );
}
