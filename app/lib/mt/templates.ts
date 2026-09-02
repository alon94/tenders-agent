// ============================================================
// מיני־מכרז — תבניות מייל (אפיון מוצרי סעיף 7 — מטריצת ההתראות).
// תבנית אחת גנרית RTL בסגנון מיילי המערכת + נושא לפי סוג ההתראה.
// ============================================================

const SUBJECT_PREFIX: Record<string, string> = {
  mt_published: "✅",
  mt_match: "📢 הזדמנות חדשה —",
  mt_invite: "✉️ הוזמנתם להגיש הצעה —",
  mt_proposal_received: "📥",
  mt_proposal_submitted: "✅ ההצעה התקבלה —",
  mt_question: "❓ שאלה חדשה —",
  mt_clarification: "📌 הבהרה —",
  mt_reminder_24h: "⏰",
  mt_closed: "🔒",
  mt_closed_bidder: "🔒",
  mt_extended: "🗓️ הארכת מועד —",
  mt_awarded_winner: "🏆 זכיתם!",
  mt_awarded_lost: "🙏",
  mt_no_award: "🙏",
  mt_cancelled: "⚠️ בוטל —",
  mt_expired: "⚠️",
  mt_reminder_decide: "⏰",
  mt_outcome_ask: "❔",
  mt_private_clarification: "💬 בקשת הבהרה —",
};

export function subjectFor(type: string, title: string): string {
  const p = SUBJECT_PREFIX[type];
  return p ? `${p} ${title}` : title;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export function renderNotificationEmail(o: { title: string; body: string; link: string; cta?: string }): string {
  return `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a2330;line-height:1.7;max-width:560px;margin:0 auto;padding:8px">
  <div style="background:#2b6fc4;color:#fff;border-radius:10px 10px 0 0;padding:12px 18px;font-weight:700;font-size:15px">שווה מכרזים · מיני־מכרז</div>
  <div style="border:1px solid #dde3e8;border-top:none;border-radius:0 0 10px 10px;padding:18px">
    <h2 style="margin:0 0 10px;font-size:18px;color:#1a2330">${esc(o.title)}</h2>
    <p style="margin:0 0 18px;color:#3d4852">${esc(o.body).replace(/\n/g, "<br>")}</p>
    <a href="${esc(o.link)}" style="display:inline-block;background:#2b6fc4;color:#fff;text-decoration:none;padding:10px 20px;border-radius:9px;font-weight:700">${esc(o.cta || "לצפייה באתר")}</a>
    <p style="margin:22px 0 0;font-size:12px;color:#9aa6b2">הודעה אוטומטית ממועדון עסקים 360. הפלטפורמה מתווכת מידע בלבד ואינה צד להתקשרות בין העסקים.</p>
  </div>
</div>`;
}
