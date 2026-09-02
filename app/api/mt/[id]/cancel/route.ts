// /api/mt/[id]/cancel — ביטול מיני־מכרז פתוח (חובת סיבה). כל המגישים מקבלים הודעה.
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
  if (t.status === "draft") {
    await dbUpdate("mt_tenders", `?id=eq.${id}`, { status: "archived" });
    return ok({ ok: true, status: "archived" });
  }
  if (t.status !== "open") throw conflict("אפשר לבטל רק מיני־מכרז פתוח");
  const b = await readJson<Raw>(req);
  const reason = oneOf(b.reason, "סיבת ביטול", CLOSED_REASONS)!;
  const note = str(b.note, "הערה", { max: 500, optional: true });

  await dbUpdate("mt_tenders", `?id=eq.${id}`, { status: "cancelled", closed_reason: reason, closed_note: note, closed_at: new Date().toISOString() });
  const bidders = await dbSelect<{ id: string; bidder_profile_id: string }>("mt_proposals", `?tender_id=eq.${id}&status=eq.submitted&select=id,bidder_profile_id`);
  if (bidders.length) await dbUpdate("mt_proposals", `?tender_id=eq.${id}&status=eq.submitted`, { status: "expired" });
  await notifyMany(bidders.map((x) => x.bidder_profile_id), "mt_cancelled", id, null,
    `המיני־מכרז "${t.title}" בוטל`, "המזמין ביטל את המיני־מכרז. תודה על ההצעה — נעדכן על הזדמנויות חדשות בתחום.", "/mt/open");
  await logEvent(id, null, actor.userId, "buyer", "mt_cancelled", { reason, proposals: bidders.length });
  waitUntil(dispatchEmailQueue().catch(() => undefined));
  return ok({ ok: true, status: "cancelled" });
});
