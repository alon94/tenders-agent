// ============================================================
// מיני־מכרז — שליחת SMS ל-OTP (אפיון טכני סעיף 10).
// ממשק ספק-אגנוסטי: SMS_WEBHOOK_URL מקבל POST JSON {to, text} עם Bearer SMS_API_KEY.
// כך אפשר לחבר InforU / 019 / Twilio דרך שכבת תיווך קטנה בלי לשנות קוד כאן.
// בלי הגדרה (פיתוח): הקוד מודפס ללוג ולא נשלח.
// ============================================================

export async function sendSms(to: string, text: string): Promise<boolean> {
  const url = process.env.SMS_WEBHOOK_URL;
  if (!url) {
    console.log(`[mt] SMS (dev, not sent) → ${to}: ${text}`);
    return process.env.NODE_ENV !== "production";
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SMS_API_KEY || ""}` },
      body: JSON.stringify({ to, text, sender: process.env.SMS_SENDER || "ShavehMichrazim" }),
    });
    return res.ok;
  } catch (e) {
    console.error("[mt] sendSms failed:", e);
    return false;
  }
}
