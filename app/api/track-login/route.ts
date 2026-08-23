import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import nodemailer from "nodemailer";
import { recordLoginEvent, recordEmail } from "@/app/lib/ops";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// POST /api/track-login  (Authorization: Bearer <user token>)
// נקרא מהלקוח אחרי התחברות מוצלחת — רושם אירוע כניסה לאנליטיקה.
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !SUPABASE_URL) return NextResponse.json({ ok: false });
  // מאמתים שהטוקן אמיתי ושייך למשתמש — לא סומכים על מייל מהלקוח
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ ok: false });
  const user = await res.json().catch(() => null);
  if (user?.email) {
    await recordLoginEvent(user.email);
    // התראת מנהל: מייל על כל התחברות — נשלח ברקע, לא מעכב את המשתמש
    waitUntil(sendLoginAlert(String(user.email)));
  }
  return NextResponse.json({ ok: true });
}

const ADMIN_EMAIL = "alonkatabi17@gmail.com";

async function sendLoginAlert(userEmail: string): Promise<void> {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    const now = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const info = await transporter.sendMail({
      from: `"שווה מכרזים 📋" <${process.env.GMAIL_USER}>`,
      to: ADMIN_EMAIL,
      subject: `🔔 התחברות לאתר: ${userEmail}`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px;color:#1a2330">
        <p><strong>${userEmail}</strong> התחבר/ה לשווה מכרזים.</p>
        <p style="color:#667380">מועד: ${now}</p>
        <p style="font-size:12px;color:#9aa6b2">הודעה אוטומטית — נשלחת על כל התחברות. הרשימה המלאה במסך הניהול.</p>
      </div>`,
    });
    await recordEmail({ recipient: ADMIN_EMAIL, type: "login-alert", tender_count: 0, status: "sent", message_id: String(info.messageId || "") });
  } catch (e) {
    console.error("track-login: login alert email failed:", e);
  }
}
