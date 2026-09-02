// /api/mt/proposals/[pid]/award — בחירת זוכה (evaluating → awarded). תומך פיצול לפי שורה אם allow_split_award.
import { waitUntil } from "@vercel/functions";
import { requireProfile } from "@/app/lib/mt/auth";
import { dbCount, dbInsert, dbOne, dbSelect, dbUpdate } from "@/app/lib/mt/db";
import { logEvent, notify } from "@/app/lib/mt/events";
import { bad, conflict, handle, notFound, ok, readJson, type Params } from "@/app/lib/mt/http";
import { dispatchEmailQueue } from "@/app/lib/mt/mailer";
import { assertBuyer, loadItems, loadTender } from "@/app/lib/mt/tender";
import type { BusinessProfileRow, MtProposal } from "@/app/lib/mt/types";
import { bool, str, uuid, type Raw } from "@/app/lib/mt/validate";

export const dynamic = "force-dynamic";

export const POST = handle(async (req, ctx: Params<{ pid: string }>) => {
  const { pid } = await ctx.params;
  const actor = await requireProfile(req);
  const p = await dbOne<MtProposal>("mt_proposals", `?id=eq.${pid}&select=*`);
  if (!p) throw notFound("ההצעה לא נמצאה");
  const t = await loadTender(p.tender_id);
  assertBuyer(t, actor.profile.user_id);
  if (t.status !== "evaluating") throw conflict("בחירת זוכה אפשרית רק בשלב הבחירה");
  if (p.status !== "submitted") throw conflict("אפשר לבחור רק הצעה שהוגשה ולא נמשכה");
  const b = await readJson<Raw>(req).catch(() => ({} as Raw));
  const itemId = uuid(b.tender_item_id, "שורה", { optional: true });
  if (itemId && !t.allow_split_award) throw bad("פיצול זכייה לא הופעל במיני־מכרז זה");
  if (itemId) {
    const items = await loadItems(t.id);
    if (!items.find((i) => i.id === itemId)) throw bad("שורה לא שייכת למיני־מכרז");
  }
  const message = str(b.message, "הודעה לזוכה", { max: 1000, optional: true });
  const shareRank = bool(b.share_rank, "שיתוף דירוג", true);

  await dbInsert("mt_awards", {
    tender_id: t.id, proposal_id: pid, tender_item_id: itemId, message_to_winner: message,
    share_rank_with_others: shareRank, awarded_by_user_id: actor.userId,
  });

  // זכייה כוללת, או פיצול שהשלים את כל השורות → סוגרים את המיני־מכרז
  let finalize = !itemId;
  if (itemId) {
    const items = await loadItems(t.id);
    const awarded = await dbCount("mt_awards", `?tender_id=eq.${t.id}&tender_item_id=not.is.null`);
    finalize = awarded >= items.filter((i) => !i.is_optional).length;
  }
  await dbUpdate("mt_proposals", `?id=eq.${pid}`, { status: "won" });
  const winner = await dbOne<BusinessProfileRow>("business_profiles", `?user_id=eq.${p.bidder_profile_id}&select=user_id,email,categories,region`);
  const buyer = actor.profile;
  await notify(p.bidder_profile_id, "mt_awarded_winner", t.id, pid, `ההצעה שלכם ל"${t.title}" נבחרה!`,
    `${message ? "הודעה מהמזמין: " + message + "\n" : ""}פרטי קשר של המזמין: ${buyer.email || "—"}. משם — ממשיכים ישירות ביניכם.`, `/mt/${t.id}`);

  if (finalize) {
    await dbUpdate("mt_tenders", `?id=eq.${t.id}`, { status: "awarded", awarded_at: new Date().toISOString() });
    const others = await dbSelect<MtProposal>("mt_proposals", `?tender_id=eq.${t.id}&status=eq.submitted&select=id,bidder_profile_id,rank`);
    if (others.length) await dbUpdate("mt_proposals", `?tender_id=eq.${t.id}&status=eq.submitted`, { status: "lost" });
    const total = others.length + 1;
    for (const o of others) {
      await notify(o.bidder_profile_id, "mt_awarded_lost", t.id, o.id, `תודה על ההצעה ל"${t.title}"`,
        `נבחרה הצעה אחרת.${shareRank && o.rank ? ` הצעתכם דורגה ${o.rank} מתוך ${total} לפי מחיר.` : ""} נשמח לראות אתכם במיני־מכרזים הבאים בתחום.`, "/mt/open");
    }
  }
  await notify(t.buyer_profile_id, "mt_awarded_buyer", t.id, pid, `בחרתם זוכה ל"${t.title}"`,
    `פרטי הזוכה: ${winner?.email || "—"}. בעוד 14 יום נשאל אם ההתקשרות יצאה לפועל.`, `/mt/${t.id}/compare`);
  await logEvent(t.id, pid, actor.userId, "buyer", "mt_awarded", { rank_of_winner: p.rank, split_item: itemId, finalized: finalize });
  waitUntil(dispatchEmailQueue().catch(() => undefined));
  return ok({ ok: true, finalized: finalize, winner: { profile_id: p.bidder_profile_id, email: winner?.email || null } });
});
