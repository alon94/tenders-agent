// /api/mt/proposals/[pid]/clarify — בקשת הבהרה פרטית בשלב הבחירה (המזמין שואל, המציע עונה). לא משנה מחיר.
import { waitUntil } from "@vercel/functions";
import { requireProfile } from "@/app/lib/mt/auth";
import { dbInsert, dbOne, dbSelect, dbUpdate } from "@/app/lib/mt/db";
import { logEvent, notify } from "@/app/lib/mt/events";
import { conflict, forbidden, handle, notFound, ok, readJson, type Params } from "@/app/lib/mt/http";
import { dispatchEmailQueue } from "@/app/lib/mt/mailer";
import { loadTender } from "@/app/lib/mt/tender";
import type { MtProposal } from "@/app/lib/mt/types";
import { str, type Raw } from "@/app/lib/mt/validate";

export const dynamic = "force-dynamic";
interface Clar { id: string; proposal_id: string; question: string; asked_at: string; answer: string | null; answered_at: string | null }

export const GET = handle(async (req, ctx: Params<{ pid: string }>) => {
  const { pid } = await ctx.params;
  const actor = await requireProfile(req);
  const p = await dbOne<MtProposal>("mt_proposals", `?id=eq.${pid}&select=id,tender_id,bidder_profile_id`);
  if (!p) throw notFound();
  const t = await loadTender(p.tender_id);
  const me = actor.profile.user_id;
  if (me !== t.buyer_profile_id && me !== p.bidder_profile_id) throw forbidden();
  return ok({ clarifications: await dbSelect<Clar>("mt_private_clarifications", `?proposal_id=eq.${pid}&order=asked_at.asc&select=*`) });
});

export const POST = handle(async (req, ctx: Params<{ pid: string }>) => {
  const { pid } = await ctx.params;
  const actor = await requireProfile(req);
  const p = await dbOne<MtProposal>("mt_proposals", `?id=eq.${pid}&select=id,tender_id,bidder_profile_id,status`);
  if (!p) throw notFound();
  const t = await loadTender(p.tender_id);
  if (t.status !== "evaluating") throw conflict("הבהרות פרטיות אפשריות רק בשלב הבחירה");
  const me = actor.profile.user_id;
  const b = await readJson<Raw>(req);
  const text = str(b.text, "טקסט", { min: 2, max: 1500 })!;

  if (me === t.buyer_profile_id) {
    const [c] = await dbInsert<Clar>("mt_private_clarifications", { proposal_id: pid, question: text });
    await notify(p.bidder_profile_id, "mt_private_clarification", t.id, pid, `בקשת הבהרה על ההצעה שלכם ל"${t.title}"`, text, `/mt/${t.id}`);
    await logEvent(t.id, pid, actor.userId, "buyer", "mt_clarification_requested");
    waitUntil(dispatchEmailQueue().catch(() => undefined));
    return ok({ id: c.id }, 201);
  }
  if (me === p.bidder_profile_id) {
    const open = await dbOne<Clar>("mt_private_clarifications", `?proposal_id=eq.${pid}&answer=is.null&order=asked_at.desc&select=id`);
    if (!open) throw conflict("אין בקשת הבהרה פתוחה");
    await dbUpdate("mt_private_clarifications", `?id=eq.${open.id}`, { answer: text, answered_at: new Date().toISOString() });
    await notify(t.buyer_profile_id, "mt_private_clarification", t.id, pid, `התקבלה תשובה להבהרה ב"${t.title}"`, text, `/mt/${t.id}/compare`);
    await logEvent(t.id, pid, actor.userId, "bidder", "mt_clarification_answered");
    waitUntil(dispatchEmailQueue().catch(() => undefined));
    return ok({ ok: true });
  }
  throw forbidden();
});
