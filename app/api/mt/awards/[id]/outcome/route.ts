// /api/mt/awards/[id]/outcome — שאלת «ההתקשרות יצאה לפועל?» (מזמין או זוכה)
import { requireProfile } from "@/app/lib/mt/auth";
import { dbOne, dbUpdate } from "@/app/lib/mt/db";
import { logEvent } from "@/app/lib/mt/events";
import { forbidden, handle, notFound, ok, readJson, type Params } from "@/app/lib/mt/http";
import { loadTender } from "@/app/lib/mt/tender";
import { OUTCOMES, type MtAward, type MtProposal } from "@/app/lib/mt/types";
import { oneOf, type Raw } from "@/app/lib/mt/validate";

export const dynamic = "force-dynamic";

export const POST = handle(async (req, ctx: Params<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await requireProfile(req);
  const a = await dbOne<MtAward>("mt_awards", `?id=eq.${id}&select=*`);
  if (!a) throw notFound();
  const [t, p] = await Promise.all([loadTender(a.tender_id), dbOne<MtProposal>("mt_proposals", `?id=eq.${a.proposal_id}&select=bidder_profile_id`)]);
  const me = actor.profile.user_id;
  if (me !== t.buyer_profile_id && me !== p?.bidder_profile_id) throw forbidden();
  const b = await readJson<Raw>(req);
  const outcome = oneOf(b.outcome, "תוצאה", OUTCOMES)!;
  await dbUpdate("mt_awards", `?id=eq.${id}`, { outcome, outcome_reported_at: new Date().toISOString() });
  await logEvent(t.id, a.proposal_id, actor.userId, me === t.buyer_profile_id ? "buyer" : "bidder", "mt_outcome_reported", { outcome });
  return ok({ ok: true });
});
