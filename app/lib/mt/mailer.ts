// ============================================================
// מיני־מכרז — שליחת מיילים (אפיון טכני סעיף 9).
// אותו טרנספורט Gmail/nodemailer כמו api/cron ו-api/track-login.
// dispatchEmailQueue: מרוקן את תור mt_notifications (channel=email) — נקרא
// מ-/api/mt/cron (pg_net) וגם fire-and-forget אחרי פעולות קריטיות.
// ============================================================
import nodemailer from "nodemailer";
import { dbSelect, dbUpdate } from "./db";
import { renderNotificationEmail, subjectFor } from "./templates";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tenders-agent.vercel.app";

function transport() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
}

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const t = transport();
  if (!t) { console.warn("[mt] mail not configured — skipping:", subject); return false; }
  try {
    await t.sendMail({ from: `"שווה מכרזים 📋" <${process.env.GMAIL_USER}>`, to, subject, html });
    return true;
  } catch (e) {
    console.error("[mt] sendMail failed:", subject, e);
    return false;
  }
}

interface QueuedNotification {
  id: number; user_id: string; type: string; tender_id: string | null; proposal_id: string | null;
  title: string; body: string | null; link: string | null; created_at: string;
}

/** מרוקן עד `limit` מיילים ממתינים. אידמפוטנטי: מסמן email_sent_at לפני השליחה בפועל
 *  (עדיף מייל שאבד על מייל כפול), ומחזיר את הסימון אם השליחה נכשלה בפועל. */
export async function dispatchEmailQueue(limit = 50): Promise<{ sent: number; failed: number; skipped: number }> {
  const queue = await dbSelect<QueuedNotification>(
    "mt_notifications",
    `?channel=eq.email&email_sent_at=is.null&order=created_at.asc&limit=${limit}&select=id,user_id,type,tender_id,proposal_id,title,body,link,created_at`,
  );
  if (!queue.length) return { sent: 0, failed: 0, skipped: 0 };

  const userIds = [...new Set(queue.map((q) => q.user_id))];
  const profiles = await dbSelect<{ user_id: string; email: string | null }>(
    "business_profiles", `?user_id=in.(${userIds.join(",")})&select=user_id,email`,
  );
  const emailOf = new Map(profiles.map((p) => [p.user_id, p.email]));

  let sent = 0, failed = 0, skipped = 0;
  for (const n of queue) {
    const to = emailOf.get(n.user_id);
    // סימון מוקדם — מונע שליחה כפולה אם שתי פעימות רצות במקביל
    await dbUpdate("mt_notifications", `?id=eq.${n.id}&email_sent_at=is.null`, { email_sent_at: new Date().toISOString() });
    if (!to) { skipped++; continue; }
    const okSend = await sendMail(to, subjectFor(n.type, n.title), renderNotificationEmail({
      title: n.title, body: n.body || "", link: n.link ? `${SITE}${n.link}` : SITE,
    }));
    if (okSend) sent++;
    else { failed++; await dbUpdate("mt_notifications", `?id=eq.${n.id}`, { email_sent_at: null }); }
  }
  return { sent, failed, skipped };
}

/** מיילי הזמנה ישירה למוזמנים חיצוניים (לא דרך mt_notifications — אין להם user_id). */
export async function sendInviteEmails(
  tender: { id: string; title: string; deadline_at: string | null; region: string | null },
  invitations: { token: string; invitee_email: string | null; invitee_name: string | null }[],
  inviterLabel: string,
): Promise<number> {
  let n = 0;
  for (const inv of invitations) {
    if (!inv.invitee_email) continue;
    const html = renderNotificationEmail({
      title: `${inviterLabel} מזמין אתכם להגיש הצעה: ${tender.title}`,
      body: `${inv.invitee_name ? inv.invitee_name + ", " : ""}קיבלתם הזמנה אישית להגיש הצעת מחיר במיני־מכרז${tender.region ? " באזור " + tender.region : ""}.` +
        (tender.deadline_at ? `\nמועד אחרון להגשה: ${new Date(tender.deadline_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}.` : "") +
        "\nההגשה קצרה ומובנית; ההצעה חתומה עד למועד האחרון ונחשפת רק למזמין.",
      link: `${SITE}/mt/i/${inv.token}`, cta: "לצפייה והגשת הצעה",
    });
    if (await sendMail(inv.invitee_email, subjectFor("mt_invite", tender.title), html)) n++;
  }
  return n;
}
