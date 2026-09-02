// /api/mt/[id]/view — רישום צפייה (למונה החשוף ולתזכורות). אידמפוטנטי ליום.
import { requireActor } from "@/app/lib/mt/auth";
import { dbInsert, dbRpc } from "@/app/lib/mt/db";
import { handle, ok, type Params } from "@/app/lib/mt/http";
import { loadTender } from "@/app/lib/mt/tender";

export const dynamic = "force-dynamic";

export const POST = handle(async (req, ctx: Params<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await requireActor(req);
  const t = await loadTender(id);
  if (!actor.profile || actor.profile.user_id === t.buyer_profile_id) return ok({ ok: true });
  try {
    await dbInsert("mt_views", { tender_id: id, viewer_key: actor.profile.user_id }, { upsertOn: "tender_id,viewer_key,view_date" });
    await dbRpc("mt_bump_views", { p_tender: id }).catch(() => undefined);
  } catch { /* צפייה כפולה באותו יום — מתעלמים */ }
  return ok({ ok: true });
});
