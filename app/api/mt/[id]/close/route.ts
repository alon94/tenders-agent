// /api/mt/[id]/close — סגירה ללא בחירה (evaluating → no_award)
import { waitUntil } from "@vercel/functions";
import { requireProfile } from "@/app/lib/mt/auth";
import { dbSelect, dbUpdate } from "@/app/lib/mt/db";
import { logEvent, notifyMany } from "@/app/lib/mt/events";
import { conflict, handle, ok, readJson, type Params } from "@/app/lib/mt/http";
import { dispatchEmailQueue } from "@/app/lib/mt/mailer";
import { assertBuyer, loadTender } from "@/app/lib/mt/tender";
import { CLOSED_REASONS } from "@/app/lib/mt/types";
import { oneOf, str, type Raw } from "@/app/lib/mt/validate";

export const dynamic = "force-dynamic";

export const POST = handle(async (req, ctx: Params<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await requireProfile(req);
  const t = await loadTender(id);
  assertBuyer(t, actor.profile.user_id);
  if (t.status !== "evaluating") throw conflict("סגירה ללא בחירה אפשרית רק בשלב הבחירה");
  const b = await readJson<Raw>(req);
  const reason = oneOf(b.reason, "סיבה", CLOSED_REASONS)!;
  const note = str(b.note, "הערה", { max: 500, optional: true });
  await dbUpdate("mt_tenders", `?id=eq.${id}`, { status: "no_award", closed_reason: reason, closed_note: note });
  const bidders = await dbSelect<{ bidder_profile_id: string }>("mt_proposals", `?tender_id=eq.${id}&status=eq.submitted&select=bidder_profile_id`);
  await dbUpdate("mt_proposals", `?tender_id=eq.${id}&status=eq.submitted`, { status: "lost" });
  await notifyMany(bidders.map((x) => x.bidder_profile_id), "mt_no_award", id, null,
    `המיני־מכרז "${t.title}" נסגר ללא בחירה`, "המזמין החליט לא לבחור הצעה הפעם. תודה על הזמן שהשקעתם.", "/mt/open");
  await logEvent(id, null, actor.userId, "buyer", "mt_no_award", { reason });
  waitUntil(dispatchEmailQueue().catch(() => undefined));
  return ok({ ok: true, status: "no_award" });
});
