// /api/mt/files/[id] — הורדה מאובטחת: בדיקת הרשאה לפי הישות → redirect ל-signed URL (10 דק')
import { requireProfile } from "@/app/lib/mt/auth";
import { dbDelete, dbOne, storageSignedDownload } from "@/app/lib/mt/db";
import { forbidden, handle, notFound, ok, type Params } from "@/app/lib/mt/http";
import { loadTender } from "@/app/lib/mt/tender";
import type { MtAttachment, MtProposal } from "@/app/lib/mt/types";

export const dynamic = "force-dynamic";

async function canAccess(a: MtAttachment, profileId: string, forDelete = false): Promise<boolean> {
  if (a.owner_type === "tender") {
    const t = await loadTender(a.owner_id);
    if (t.buyer_profile_id === profileId) return true;
    if (forDelete) return false;
    return ["open", "evaluating", "awarded"].includes(t.status) && !t.blocked_profile_ids.includes(profileId);
  }
  if (a.owner_type === "proposal") {
    const p = await dbOne<MtProposal>("mt_proposals", `?id=eq.${a.owner_id}&select=id,tender_id,bidder_profile_id,sealed_until`);
    if (!p) return false;
    if (p.bidder_profile_id === profileId) return true;
    if (forDelete) return false;
    const t = await loadTender(p.tender_id);
    return t.buyer_profile_id === profileId && new Date(p.sealed_until).getTime() <= Date.now();
  }
  return false;
}

export const GET = handle(async (req, ctx: Params<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await requireProfile(req);
  const a = await dbOne<MtAttachment>("mt_attachments", `?id=eq.${id}&select=*`);
  if (!a) throw notFound("הקובץ לא נמצא");
  if (!(await canAccess(a, actor.profile.user_id))) throw forbidden();
  const url = await storageSignedDownload(a.storage_path, 600);
  if (new URL(req.url).searchParams.get("json") === "1") return ok({ url, file_name: a.file_name, mime: a.mime });
  return Response.redirect(url, 302);
});

export const DELETE = handle(async (req, ctx: Params<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await requireProfile(req);
  const a = await dbOne<MtAttachment>("mt_attachments", `?id=eq.${id}&select=*`);
  if (!a) throw notFound();
  if (!(await canAccess(a, actor.profile.user_id, true))) throw forbidden();
  await dbDelete("mt_attachments", `?id=eq.${id}`);
  return ok({ ok: true });
});
