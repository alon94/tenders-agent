// /api/mt — GET: המיני־מכרזים שלי + ההצעות שלי · POST: יצירת טיוטה
import { requireActor, requireCompleteProfile } from "@/app/lib/mt/auth";
import { dbInsert, dbSelect } from "@/app/lib/mt/db";
import { logEvent } from "@/app/lib/mt/events";
import { handle, ok } from "@/app/lib/mt/http";
import { assertCanCreate, countActiveTenders } from "@/app/lib/mt/tender";
import type { MtProposal, MtTender } from "@/app/lib/mt/types";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const actor = await requireActor(req);
  if (!actor.profile) return ok({ mine: [], proposals: [] });
  const pid = actor.profile.user_id;
  const [mine, proposals] = await Promise.all([
    dbSelect<MtTender>("mt_tenders", `?buyer_profile_id=eq.${pid}&deleted_at=is.null&status=neq.archived&order=updated_at.desc&select=id,status,title,category_ids,deadline_at,proposals_count,views_count,published_at,closed_at,created_at,updated_at`),
    dbSelect<MtProposal & { mt_tenders: Pick<MtTender, "id" | "title" | "status" | "deadline_at"> }>(
      "mt_proposals",
      `?bidder_profile_id=eq.${pid}&order=created_at.desc&select=id,tender_id,status,total,rank,last_updated_at,created_at,mt_tenders(id,title,status,deadline_at)`,
    ),
  ]);
  return ok({ mine, proposals });
});

export const POST = handle(async (req) => {
  const actor = await requireCompleteProfile(req);
  const active = await countActiveTenders(actor.profile.user_id);
  assertCanCreate(active);
  const [t] = await dbInsert<MtTender>("mt_tenders", {
    buyer_profile_id: actor.profile.user_id,
    created_by_user_id: actor.userId,
    region: actor.profile.region,
    category_ids: (actor.profile.categories || []).slice(0, 1),
  });
  await logEvent(t.id, null, actor.userId, "buyer", "mt_wizard_started");
  return ok({ id: t.id }, 201);
});
