// /api/mt/cron — נקרא מ-pg_net אחרי mt_tick (כל 5 דק'), וגם ידנית. מרוקן את תור המיילים.
// אימות: כותרת x-mt-secret = MT_CRON_SECRET (או Bearer CRON_SECRET של Vercel).
import { dbRpc } from "@/app/lib/mt/db";
import { handle, ok, unauthorized } from "@/app/lib/mt/http";
import { dispatchEmailQueue } from "@/app/lib/mt/mailer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.MT_CRON_SECRET || "";
  const hdr = req.headers.get("x-mt-secret") || "";
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  return (!!secret && hdr === secret) || (!!process.env.CRON_SECRET && bearer === process.env.CRON_SECRET);
}

async function runOnce(req: Request) {
  if (!authorized(req)) throw unauthorized("secret לא תקין");
  // אם קוראים ידנית (לא מ-pg_net) — מריצים גם את הפעימה עצמה
  const tick = new URL(req.url).searchParams.get("tick") === "1"
    ? await dbRpc<{ closed: number; expired: number; no_decision: number; completed: number }[]>("mt_tick", {}).catch(() => null)
    : null;
  const mail = await dispatchEmailQueue(100);
  return ok({ ok: true, tick: tick?.[0] ?? null, mail });
}
export const POST = handle(runOnce);
export const GET = handle(runOnce);
