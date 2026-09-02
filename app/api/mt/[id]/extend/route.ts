// /api/mt/[id]/extend — הארכת מועד: פעם אחת, רק כשיש פחות מ-2 הצעות (open או expired)
import { waitUntil } from "@vercel/functions";
import { requireProfile } from "@/app/lib/mt/auth";
import { dbSelect, dbUpdate } from "@/app/lib/mt/db";
import { logEvent, notifyMany } from "@/app/lib/mt/events";
import { bad, conflict, handle, ok, readJson, type Params } from "@/app/lib/mt/http";
import { dispatchEmailQueue } from "@/app/lib/mt/mailer";
import { assertBuyer, loadTender } from "@/app/lib/mt/tender";
import { LIMITS } from "@/app/lib/mt/types";
import { isoDate, type Raw } from "@/app/lib/mt/validate";

export const dynamic = "force-dynamic";

export const POST = handle(async (req, ctx: Params<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await requireProfile(req);
  const t = await loadTender(id);
  assertBuyer(t, actor.profile.user_id);
  if (t.status !== "open" && t.status !== "expired") throw conflict("אפשר להאריך רק מיני־מכרז פתוח או שפג");
  if (t.extended_once_at) throw conflict("המועד כבר הוארך פעם אחת — לפרסום נוסף יש לשכפל את המיני־מכרז", "already_extended");
  if (t.proposals_count >= LIMITS.extendAllowedBelowProposals) throw conflict(`הארכה אפשרית רק כשיש פחות מ-${LIMITS.extendAllowedBelowProposals} הצעות`);
  const b = await readJson<Raw>(req);
  const newDeadline = isoDate(b.deadline_at, "מועד חדש")!;
  const hours = (new Date(newDeadline).getTime() - Date.now()) / 3.6e6;
  if (hours < LIMITS.minDeadlineHours) throw bad(`המועד החדש חייב להיות לפחות ${LIMITS.minDeadlineHours} שעות מעכשיו`);
  if (hours > LIMITS.maxDeadlineDays * 24) throw bad(`המועד החדש חייב להיות בתוך ${LIMITS.maxDeadlineDays} יום`);
  const questionsClose = new Date(new Date(newDeadline).getTime() - LIMITS.questionsCloseBeforeHours * 3.6e6).toISOString();

  await dbUpdate("mt_tenders", `?id=eq.${id}`, {
    status: "open", deadline_at: newDeadline, questions_close_at: questionsClose,
    extended_once_at: new Date().toISOString(), closed_at: null,
  });
  // ההצעות שכבר הוגשו נשארות חתומות עד המועד החדש
  await dbUpdate("mt_proposals", `?tender_id=eq.${id}&status=eq.submitted`, { sealed_until: newDeadline });

  const audience = await dbSelect<{ bidder_profile_id: string }>("mt_proposals", `?tender_id=eq.${id}&status=eq.submitted&select=bidder_profile_id`);
  const viewers = await dbSelect<{ viewer_key: string }>("mt_views", `?tender_id=eq.${id}&select=viewer_key`);
  await notifyMany([...audience.map((a) => a.bidder_profile_id), ...viewers.map((v) => v.viewer_key)].filter((u) => u !== t.buyer_profile_id),
    "mt_extended", id, null, `המועד ל"${t.title}" הוארך`,
    `המועד האחרון החדש: ${new Date(newDeadline).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}. הצעות שהוגשו נשארות בתוקף.`, `/mt/${id}`);
  await logEvent(id, null, actor.userId, "buyer", "mt_extended", { from: t.deadline_at, to: newDeadline });
  waitUntil(dispatchEmailQueue().catch(() => undefined));
  return ok({ ok: true, deadline_at: newDeadline });
});
