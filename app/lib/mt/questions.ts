// ============================================================
// מיני־מכרז — שאלות והבהרות: שידור הבהרה לכל מי שהגיש או צפה.
// ============================================================
import { dbSelect } from "./db";
import { notifyMany } from "./events";

export async function broadcastClarification(tenderId: string, title: string, n: number, text: string, requiresUpdate: boolean) {
  const [bidders, viewers] = await Promise.all([
    dbSelect<{ bidder_profile_id: string }>("mt_proposals", `?tender_id=eq.${tenderId}&status=eq.submitted&select=bidder_profile_id`),
    dbSelect<{ viewer_key: string }>("mt_views", `?tender_id=eq.${tenderId}&select=viewer_key`),
  ]);
  await notifyMany([...bidders.map((x) => x.bidder_profile_id), ...viewers.map((v) => v.viewer_key)], "mt_clarification", tenderId, null,
    `הבהרה ${n} ב"${title}"${requiresUpdate ? " — נדרש אישור/עדכון ההצעה" : ""}`, text, `/mt/${tenderId}#clarifications`);
}
