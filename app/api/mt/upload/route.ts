// /api/mt/upload — POST {owner_type, owner_id, file_name, mime, size} → signed upload URL
//                  POST ?confirm=1 {path, ...} → רישום mt_attachments אחרי העלאה מוצלחת
import { randomUUID } from "crypto";
import { requireProfile } from "@/app/lib/mt/auth";
import { dbCount, dbInsert, dbOne, storageExists, storageSignedUpload } from "@/app/lib/mt/db";
import { bad, conflict, forbidden, handle, notFound, ok, readJson } from "@/app/lib/mt/http";
import { loadTender } from "@/app/lib/mt/tender";
import { ALLOWED_MIME, LIMITS, type MtProposal } from "@/app/lib/mt/types";
import { num, oneOf, str, uuid, type Raw } from "@/app/lib/mt/validate";

export const dynamic = "force-dynamic";

async function authorizeOwner(ownerType: "tender" | "proposal", ownerId: string, profileId: string): Promise<{ tenderId: string; max: number }> {
  if (ownerType === "tender") {
    const t = await loadTender(ownerId);
    if (t.buyer_profile_id !== profileId) throw forbidden();
    if (t.status !== "draft" && t.status !== "open") throw conflict("אי אפשר להוסיף קבצים בשלב זה");
    return { tenderId: t.id, max: LIMITS.maxTenderFiles };
  }
  const p = await dbOne<MtProposal>("mt_proposals", `?id=eq.${ownerId}&select=id,tender_id,bidder_profile_id,sealed_until,status`);
  if (!p) throw notFound("ההצעה לא נמצאה");
  if (p.bidder_profile_id !== profileId) throw forbidden();
  if (new Date(p.sealed_until).getTime() <= Date.now()) throw conflict("המועד עבר — אי אפשר לשנות קבצים", "deadline_passed");
  return { tenderId: p.tender_id, max: LIMITS.maxProposalFiles };
}

export const POST = handle(async (req) => {
  const actor = await requireProfile(req);
  const b = await readJson<Raw>(req);
  const confirm = new URL(req.url).searchParams.get("confirm") === "1";
  const ownerType = oneOf(b.owner_type, "סוג ישות", ["tender", "proposal"] as const)!;
  const ownerId = uuid(b.owner_id, "מזהה ישות")!;
  const { tenderId, max } = await authorizeOwner(ownerType, ownerId, actor.profile.user_id);
  const fileName = str(b.file_name, "שם קובץ", { min: 1, max: 160 })!.replace(/[\\/:*?"<>|]/g, "_");
  const mime = str(b.mime, "סוג קובץ", { max: 100 })!;
  const size = num(b.size, "גודל", { min: 1, max: LIMITS.maxFileBytes, int: true })!;
  if (!ALLOWED_MIME.has(mime)) throw bad("סוג קובץ לא נתמך — PDF, תמונה, Word או Excel בלבד", "mime");

  if (!confirm) {
    const count = await dbCount("mt_attachments", `?owner_type=eq.${ownerType}&owner_id=eq.${ownerId}`);
    if (count >= max) throw bad(`עד ${max} קבצים`, "limit_files");
    const path = `${tenderId}/${ownerType}/${randomUUID()}-${fileName}`;
    const signed = await storageSignedUpload(path);
    return ok({ path, upload_url: signed.url, token: signed.token, method: "PUT" });
  }

  const path = str(b.path, "נתיב", { max: 400 })!;
  if (!path.startsWith(`${tenderId}/${ownerType}/`)) throw forbidden();
  if (!(await storageExists(path))) throw bad("הקובץ לא נמצא באחסון — ההעלאה לא הושלמה", "not_uploaded");
  const [row] = await dbInsert<{ id: string }>("mt_attachments", {
    owner_type: ownerType, owner_id: ownerId, storage_path: path, file_name: fileName, mime, size_bytes: size,
    uploaded_by_user_id: actor.userId, scanned_ok: null,
  });
  return ok({ id: row.id }, 201);
});
