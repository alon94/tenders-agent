// /api/mt/[id]/questions — POST: מציע שואל (עד questions_close_at). הבהרה יזומה של המזמין: text + published=true בלי שאלה.
import { waitUntil } from "@vercel/functions";
import { requireProfile } from "@/app/lib/mt/auth";
import { dbCount, dbInsert } from "@/app/lib/mt/db";
import { broadcastClarification } from "@/app/lib/mt/questions";
import { logEvent, notify } from "@/app/lib/mt/events";
import { conflict, forbidden, handle, ok, readJson, type Params } from "@/app/lib/mt/http";
import { dispatchEmailQueue } from "@/app/lib/mt/mailer";
import { checkRate } from "@/app/lib/mt/rate";
import { loadTender } from "@/app/lib/mt/tender";
import type { MtQuestion } from "@/app/lib/mt/types";
import { assertNotBlocked, bool, str, type Raw } from "@/app/lib/mt/validate";

export const dynamic = "force-dynamic";

export const POST = handle(async (req, ctx: Params<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await requireProfile(req);
  const t = await loadTender(id);
  const b = await readJson<Raw>(req);
  const isBuyer = t.buyer_profile_id === actor.profile.user_id;

  if (isBuyer) {
    // הבהרה יזומה
    if (t.status !== "open") throw conflict("אפשר לפרסם הבהרה רק כשהמיני־מכרז פתוח");
    const text = str(b.text, "הבהרה", { min: 3, max: 3000 })!;
    const requiresUpdate = bool(b.requires_proposal_update, "דורש עדכון", false);
    const n = await dbCount("mt_questions", `?tender_id=eq.${id}&is_published=eq.true`);
    const [q] = await dbInsert<MtQuestion>("mt_questions", {
      tender_id: id, asker_profile_id: null, question_text: null, answer_text: text, answered_at: new Date().toISOString(),
      is_published: true, requires_proposal_update: requiresUpdate, clarification_number: n + 1,
    });
    await broadcastClarification(t.id, t.title, q.clarification_number!, text, requiresUpdate);
    await logEvent(id, null, actor.userId, "buyer", "mt_clarification_published", { n: q.clarification_number, requiresUpdate });
    waitUntil(dispatchEmailQueue().catch(() => undefined));
    return ok({ id: q.id, clarification_number: q.clarification_number }, 201);
  }

  if (t.status !== "open") throw conflict("המיני־מכרז אינו פתוח לשאלות");
  if (t.questions_close_at && new Date(t.questions_close_at).getTime() < Date.now()) throw conflict("תקופת השאלות הסתיימה", "questions_closed");
  if (t.blocked_profile_ids.includes(actor.profile.user_id)) throw forbidden();
  await checkRate(`q:${actor.profile.user_id}`, 5, 3600);
  const text = str(b.text, "שאלה", { min: 5, max: 1500 })!;
  assertNotBlocked(text, "שאלה");
  const [q] = await dbInsert<MtQuestion>("mt_questions", { tender_id: id, asker_profile_id: actor.profile.user_id, question_text: text });
  await notify(t.buyer_profile_id, "mt_question", id, null, `שאלה חדשה ב"${t.title}"`, text, `/mt/${id}/manage#q-${q.id}`);
  await logEvent(id, null, actor.userId, "bidder", "mt_question_asked");
  waitUntil(dispatchEmailQueue().catch(() => undefined));
  return ok({ id: q.id }, 201);
});
