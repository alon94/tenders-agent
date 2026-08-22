import type { NextConfig } from "next";

// QA/B-7: כותרות אבטחה. הפרויקט לא שלח אף אחת מהן, בעוד שטוקני Supabase
// ו-pwadm נשמרים ב-localStorage — כלומר כל XSS היה שווה־ערך להשתלטות.
// ה-CSP מתירה 'unsafe-inline' לסגנונות ולסקריפטים כי כל העיצוב באפליקציה
// כתוב inline ו-Next מזריק סקריפטי אתחול; הידוק נוסף דורש מעבר ל-nonce.
// ה-CSP נבנה בזמן build ונצרב ב-routes-manifest, ולכן
// NEXT_PUBLIC_SUPABASE_URL חייב להיות מוגדר גם בסביבת ה-build ולא רק
// בזמן ריצה. אם הוא חסר, נופלים ל-wildcard של Supabase כדי שההתחברות
// לא תיחסם בשקט — עם אזהרה בלוג הבנייה.
const SUPABASE_ORIGIN = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
if (!SUPABASE_ORIGIN) {
  console.warn(
    "[csp] NEXT_PUBLIC_SUPABASE_URL אינו מוגדר בזמן build — connect-src נופל ל-https://*.supabase.co"
  );
}
const SUPABASE_CONNECT = SUPABASE_ORIGIN || "https://*.supabase.co";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://vercel.live",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com https://vercel.live data:",
  `connect-src 'self' https://vercel.live wss://ws-us3.pusher.com ${SUPABASE_CONNECT} ${SUPABASE_CONNECT.replace(/^https:/, "wss:")}`,
  // סרגל הכלים של Vercel ב-preview נטען כ-iframe מ-vercel.live.
  "frame-src 'self' https://vercel.live",
  "img-src 'self' data: https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
