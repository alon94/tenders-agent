// ============================================================
// מיני־מכרז — הגבלת קצב פשוטה על טבלת mt_rate (אפיון טכני סעיף 11). בלי Redis.
// חלון קבוע: אם window_start ישן מהחלון — מתאפס. תנאי מרוץ קל מקובל ב-MVP.
// ============================================================
import { dbInsert, dbOne } from "./db";
import { tooMany } from "./http";

interface RateRow { key: string; window_start: string; count: number }

export async function checkRate(key: string, limit: number, windowSeconds: number): Promise<void> {
  const now = Date.now();
  const row = await dbOne<RateRow>("mt_rate", `?key=eq.${encodeURIComponent(key)}&select=key,window_start,count`);
  const fresh = row && now - new Date(row.window_start).getTime() < windowSeconds * 1000;
  const count = fresh ? row!.count : 0;
  if (count >= limit) throw tooMany();
  await dbInsert("mt_rate", {
    key, count: count + 1, window_start: fresh ? row!.window_start : new Date(now).toISOString(),
  }, { upsertOn: "key" });
}
