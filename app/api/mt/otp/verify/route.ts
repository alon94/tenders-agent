// /api/mt/otp/verify — אימות הקוד, יצירת/איתור משתמש, החזרת סשן במבנה של authClient
import { dbDelete, dbOne, dbUpdate } from "@/app/lib/mt/db";
import { bad, handle, ok, readJson } from "@/app/lib/mt/http";
import { hashOtp, sessionForPhone } from "@/app/lib/mt/otp";
import { normalizePhone, str, type Raw } from "@/app/lib/mt/validate";

export const dynamic = "force-dynamic";
interface OtpRow { phone: string; code_hash: string; expires_at: string; attempts: number }

export const POST = handle(async (req) => {
  const b = await readJson<Raw>(req);
  const phone = normalizePhone(b.phone);
  const code = str(b.code, "קוד", { min: 6, max: 6 })!;
  const row = await dbOne<OtpRow>("mt_otp", `?phone=eq.${phone}&select=*`);
  if (!row || new Date(row.expires_at).getTime() < Date.now()) throw bad("הקוד פג תוקף — בקשו קוד חדש", "otp_expired");
  if (row.attempts >= 5) throw bad("יותר מדי ניסיונות — בקשו קוד חדש", "otp_locked");
  if (row.code_hash !== hashOtp(phone, code)) {
    await dbUpdate("mt_otp", `?phone=eq.${phone}`, { attempts: row.attempts + 1 });
    throw bad("קוד שגוי", "otp_wrong");
  }
  await dbDelete("mt_otp", `?phone=eq.${phone}`);
  const { session, created } = await sessionForPhone(phone, {
    businessName: str(b.business_name, "שם העסק", { max: 120, optional: true }),
    contactName: str(b.contact_name, "שם איש קשר", { max: 80, optional: true }),
    email: str(b.email, "מייל", { max: 120, optional: true }),
  });
  return ok({ created, session: { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in, user: session.user } });
});
