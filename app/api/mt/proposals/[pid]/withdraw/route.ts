// /api/mt/proposals/[pid]/withdraw — משיכת הצעה עד המועד האחרון
import { requireProfile } from "@/app/lib/mt/auth";
import { dbOne, dbUpdate } from "@/app/lib/mt/db";
import { logEvent } from "@/app/lib/mt/events";
import { conflict, forbidden, handle, notFound, ok, type Params } from "@/app/lib/mt/http";
import type { MtProposal } from "@/app/lib/mt/types";

export const dynamic = "force-dynamic";

export const POST = handle(async (req, ctx: Params<{ pid: string }>) => {
  const { pid } = await ctx.params;
  const actor = await requireProfile(req);
  const p = await dbOne<MtProposal>("mt_proposals", `?id=eq.${pid}&select=*`);
  if (!p) throw notFound("ההצעה לא נמצאה");
  if (p.bidder_profile_id !== actor.profile.user_id) throw forbidden();
  if (p.status !== "submitted") throw conflict("אפשר למשוך רק הצעה שהוגשה");
  if (new Date(p.sealed_until).getTime() <= Date.now()) throw conflict("המועד האחרון עבר — אי אפשר למשוך", "deadline_passed");
  await dbUpdate("mt_proposals", `?id=eq.${pid}`, { status: "withdrawn", withdrawn_at: new Date().toISOString() });
  await logEvent(p.tender_id, pid, actor.userId, "bidder", "mt_proposal_withdrawn");
  return ok({ ok: true });
});
