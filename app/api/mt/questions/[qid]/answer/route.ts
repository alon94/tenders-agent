// /api/mt/questions/[qid]/answer — המזמין עונה; publish=true מפרסם לכולם כהבהרה ממוספרת
import { waitUntil } from "@vercel/functions";
import { requireProfile } from "@/app/lib/mt/auth";
import { dbCount, dbOne, dbUpdate } from "@/app/lib/mt/db";
import { logEvent, notify } from "@/app/lib/mt/events";
import { conflict, handle, notFound, ok, readJson, type Params } from "@/app/lib/mt/http";
import { dispatchEmailQueue } from "@/app/lib/mt/mailer";
import { broadcastClarification } from "@/app/lib/mt/questions";
import { assertBuyer, loadTender } from "@/app/lib/mt/tender";
import type { MtQuestion } from "@/app/lib/mt/types";
import { bool, str, type Raw } from "@/app/lib/mt/validate";

export const dynamic = "force-dynamic";

export const POST = handle(async (req, ctx: Params<{ qid: string }>) => {
  const { qid } = await ctx.params;
  const actor = await requireProfile(req);
  const q = await dbOne<MtQuestion>("mt_questions", `?id=eq.${qid}&select=*`);
  if (!q) throw notFound("השאלה לא נמצאה");
  const t = await loadTender(q.tender_id);
  assertBuyer(t, actor.profile.user_id);
  if (t.status !== "open") throw conflict("אפשר לענות רק כשהמיני־מכרז פתוח");
  const b = await readJson<Raw>(req);
  const text = str(b.text, "תשובה", { min: 1, max: 3000 })!;
  const publish = bool(b.publish, "פרסום", true);
  const requiresUpdate = bool(b.requires_proposal_update, "דורש עדכון", false);
  const n = publish ? (await dbCount("mt_questions", `?tender_id=eq.${t.id}&is_published=eq.true`)) + 1 : null;
  await dbUpdate("mt_questions", `?id=eq.${qid}`, {
    answer_text: text, answered_at: new Date().toISOString(), is_published: publish,
    requires_proposal_update: publish && requiresUpdate, clarification_number: q.clarification_number ?? n,
  });
  if (publish) await broadcastClarification(t.id, t.title, q.clarification_number ?? n!, `${q.question_text ? "שאלה: " + q.question_text + "\n" : ""}תשובה: ${text}`, requiresUpdate);
  else if (q.asker_profile_id) await notify(q.asker_profile_id, "mt_clarification", t.id, null, `תשובה לשאלתך ב"${t.title}"`, text, `/mt/${t.id}`);
  await logEvent(t.id, null, actor.userId, "buyer", "mt_question_answered", { publish, requiresUpdate });
  waitUntil(dispatchEmailQueue().catch(() => undefined));
  return ok({ ok: true, clarification_number: publish ? (q.clarification_number ?? n) : null });
});
