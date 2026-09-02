// ============================================================
// מיני־מכרז — יומן אירועים והתראות (אפיון טכני סעיפים 3.4, 9).
// שתי הפונקציות עוטפות את פונקציות ה-SQL mt_log / mt_notify כדי שהלוגיקה
// (למשל כיבוד mt_notify_mode של המשתמש) תישאר במקום אחד — ב-DB.
// ============================================================
import { dbRpc } from "./db";

export type ActorRole = "buyer" | "bidder" | "system";

export async function logEvent(
  tenderId: string, proposalId: string | null, actorUserId: string | null, role: ActorRole,
  type: string, payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    await dbRpc("mt_log", { p_tender: tenderId, p_proposal: proposalId, p_actor: actorUserId, p_role: role, p_type: type, p_payload: payload });
  } catch (e) {
    console.error("[mt] logEvent failed:", type, e);
  }
}

export async function notify(
  userId: string, type: string, tenderId: string | null, proposalId: string | null,
  title: string, body: string, link: string,
): Promise<void> {
  try {
    await dbRpc("mt_notify", { p_user: userId, p_type: type, p_tender: tenderId, p_proposal: proposalId, p_title: title, p_body: body, p_link: link });
  } catch (e) {
    console.error("[mt] notify failed:", type, e);
  }
}

export async function notifyMany(userIds: string[], type: string, tenderId: string | null, proposalId: string | null,
  title: string, body: string, link: string): Promise<void> {
  await Promise.all([...new Set(userIds)].map((u) => notify(u, type, tenderId, proposalId, title, body, link)));
}
