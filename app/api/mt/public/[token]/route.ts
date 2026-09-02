// /api/mt/public/[token] — נחיתת הזמנה/קישור ציבורי. פתוח לאורחים; עותק מסונן; מסמן opened.
import { dbOne, dbSelect, dbUpdate } from "@/app/lib/mt/db";
import { handle, notFound, ok, type Params } from "@/app/lib/mt/http";
import { isViewerVisibleStatus, loadItems, loadRequirements, loadTender, shapeForViewer } from "@/app/lib/mt/tender";
import type { BusinessProfileRow, MtInvitation, MtQuestion } from "@/app/lib/mt/types";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req, ctx: Params<{ token: string }>) => {
  const { token } = await ctx.params;
  if (!/^[0-9a-f]{24}$/.test(token)) throw notFound("הקישור אינו תקין");
  const inv = await dbOne<MtInvitation>("mt_invitations", `?token=eq.${token}&status=neq.revoked&select=*`);
  let tenderId = inv?.tender_id;
  if (!inv) {
    const t = await dbOne<{ id: string; public_link_enabled: boolean }>("mt_tenders", `?public_token=eq.${token}&deleted_at=is.null&select=id,public_link_enabled`);
    if (!t || !t.public_link_enabled) throw notFound("הקישור אינו פעיל");
    tenderId = t.id;
  }
  const t = await loadTender(tenderId!);
  if (!isViewerVisibleStatus(t.status)) throw notFound("המיני־מכרז כבר אינו פתוח");
  if (inv && inv.kind === "direct" && !inv.opened_at) {
    await dbUpdate("mt_invitations", `?id=eq.${inv.id}`, { status: inv.status === "sent" ? "opened" : inv.status, opened_at: new Date().toISOString() });
  }
  const [items, reqs, buyer, questions] = await Promise.all([
    loadItems(t.id), loadRequirements(t.id),
    dbOne<BusinessProfileRow>("business_profiles", `?user_id=eq.${t.buyer_profile_id}&select=user_id,categories,region`),
    dbSelect<MtQuestion>("mt_questions_public", `?tender_id=eq.${t.id}&order=created_at.asc&select=*`),
  ]);
  return ok({
    tender: shapeForViewer(t, buyer), items, requirements: reqs, questions,
    invitation: inv ? { id: inv.id, kind: inv.kind, name: inv.invitee_name, email: inv.invitee_email, registered: !!inv.invitee_profile_id } : null,
    invite_token: token,
  });
});
