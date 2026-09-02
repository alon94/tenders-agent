// /api/mt/otp/send — רישום מקוצר למוזמן: שליחת קוד SMS (אפיון טכני סעיף 10)
import { randomInt } from "crypto";
import { hashOtp } from "@/app/lib/mt/otp";
import { dbInsert } from "@/app/lib/mt/db";
import { handle, ok, readJson } from "@/app/lib/mt/http";
import { checkRate } from "@/app/lib/mt/rate";
import { sendSms } from "@/app/lib/mt/sms";
import { normalizePhone, type Raw } from "@/app/lib/mt/validate";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const b = await readJson<Raw>(req);
  const phone = normalizePhone(b.phone);
  await checkRate(`otp:${phone}`, 3, 3600);
  const code = String(randomInt(100000, 999999));
  await dbInsert("mt_otp", { phone, code_hash: hashOtp(phone, code), expires_at: new Date(Date.now() + 10 * 60000).toISOString(), attempts: 0 }, { upsertOn: "phone" });
  const sent = await sendSms(phone, `קוד האימות שלך לשווה מכרזים: ${code}. תקף ל-10 דקות.`);
  return ok({ ok: sent, expires_in: 600 });
});
