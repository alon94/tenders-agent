// app/api/mt/email/route.ts
// נקרא מ-Supabase (pg_net) על ידי mt_dispatch_emails() כל דקה.
// מאמת x-mt-key מול MT_INTERNAL_KEY ושולח את המיילים בפועל.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MtNotification = {
  id: number;
  user_id: string;
  type: string;
  tender_id: string | null;
  proposal_id: string | null;
  title: string;
  body: string | null;
  link: string | null;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tenders-agent.vercel.app";

export async function POST(req: NextRequest) {
  // 1. אימות — רק pg_net עם המפתח הפנימי
  // משתמש ב-CRON_SECRET הקיים בפרויקט (או MT_INTERNAL_KEY אם הוגדר בנפרד)
  const expected = process.env.MT_INTERNAL_KEY ?? process.env.CRON_SECRET;
  const key = req.headers.get("x-mt-key");
  if (!expected || key !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { notifications } = (await req.json()) as { notifications: MtNotification[] };
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // 2. שליפת כתובות מייל לפי user_id (service role — עוקף RLS)
  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const userIds = [...new Set(notifications.map((n) => n.user_id))];
  const emails = new Map<string, string>();
  for (const id of userIds) {
    const { data } = await admin.auth.admin.getUserById(id);
    if (data?.user?.email) emails.set(id, data.user.email);
  }

  // 3. שליחה בפועל — כאן מחברים את ספק המייל (Resend / SendGrid / SMTP)
  let sent = 0;
  for (const n of notifications) {
    const to = emails.get(n.user_id);
    if (!to) continue;

    const href = n.link ? `${APP_URL}${n.link}` : APP_URL;
    const html = `
      <div dir="rtl" style="font-family:Arial,sans-serif;text-align:right">
        <h2>${n.title}</h2>
        ${n.body ? `<p>${n.body}</p>` : ""}
        <p><a href="${href}">לצפייה במערכת</a></p>
      </div>`;

    await sendEmail({ to, subject: n.title, html });
    sent++;
  }

  return NextResponse.json({ sent });
}

// ---- ספק המייל ----
// דוגמה ל-Resend (npm i resend, ENV: RESEND_API_KEY, MT_EMAIL_FROM).
// אם כבר יש בפרויקט פונקציית שליחה (למשל להתראות מכרזים ציבוריים) — להשתמש בה במקום.
async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[mt/email] RESEND_API_KEY missing — skipping", { to, subject });
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MT_EMAIL_FROM ?? "שווה מכרזים <no-reply@tenders-agent.vercel.app>",
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) console.error("[mt/email] resend failed", res.status, await res.text());
}
