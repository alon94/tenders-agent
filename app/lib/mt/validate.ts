// ============================================================
// מיני־מכרז — ולידציה קלה ללא תלות (במקום zod; אפיון סעיף 7 — סטייה מתועדת:
// נמנענו מתלות חדשה. אם הפרויקט יאמץ zod בעתיד, הקובץ הזה הוא נקודת ההחלפה).
// כל פונקציה מחזירה ערך נקי או זורקת 400 עם הודעה בעברית.
// ============================================================
import { bad } from "./http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type Raw = Record<string, unknown>;

export function str(v: unknown, field: string, o: { min?: number; max?: number; optional?: boolean } = {}): string | null {
  if (v === undefined || v === null || v === "") {
    if (o.optional) return null;
    throw bad(`השדה "${field}" הוא חובה`);
  }
  if (typeof v !== "string") throw bad(`השדה "${field}" חייב להיות טקסט`);
  const s = stripHtml(v).trim();
  if (o.min !== undefined && s.length < o.min) throw bad(`"${field}": לפחות ${o.min} תווים`);
  if (o.max !== undefined && s.length > o.max) throw bad(`"${field}": עד ${o.max} תווים`);
  return s;
}
export function num(v: unknown, field: string, o: { min?: number; max?: number; optional?: boolean; int?: boolean } = {}): number | null {
  if (v === undefined || v === null || v === "") {
    if (o.optional) return null;
    throw bad(`השדה "${field}" הוא חובה`);
  }
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw bad(`"${field}" חייב להיות מספר`);
  if (o.int && !Number.isInteger(n)) throw bad(`"${field}" חייב להיות מספר שלם`);
  if (o.min !== undefined && n < o.min) throw bad(`"${field}": לפחות ${o.min}`);
  if (o.max !== undefined && n > o.max) throw bad(`"${field}": עד ${o.max}`);
  return n;
}
export function bool(v: unknown, field: string, fallback?: boolean): boolean {
  if (v === undefined || v === null) {
    if (fallback !== undefined) return fallback;
    throw bad(`השדה "${field}" הוא חובה`);
  }
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  throw bad(`"${field}" חייב להיות כן/לא`);
}
export function oneOf<T extends string>(v: unknown, field: string, allowed: readonly T[], o: { optional?: boolean } = {}): T | null {
  if (v === undefined || v === null || v === "") {
    if (o.optional) return null;
    throw bad(`השדה "${field}" הוא חובה`);
  }
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    throw bad(`"${field}": ערך לא חוקי`);
  }
  return v as T;
}
export function uuid(v: unknown, field: string, o: { optional?: boolean } = {}): string | null {
  if (v === undefined || v === null || v === "") {
    if (o.optional) return null;
    throw bad(`השדה "${field}" הוא חובה`);
  }
  if (typeof v !== "string" || !UUID_RE.test(v)) throw bad(`"${field}": מזהה לא חוקי`);
  return v;
}
export function isoDate(v: unknown, field: string, o: { optional?: boolean } = {}): string | null {
  if (v === undefined || v === null || v === "") {
    if (o.optional) return null;
    throw bad(`השדה "${field}" הוא חובה`);
  }
  const d = new Date(String(v));
  if (isNaN(d.getTime())) throw bad(`"${field}": תאריך לא חוקי`);
  return d.toISOString();
}
export function arr<T>(v: unknown, field: string, o: { max?: number; optional?: boolean } = {}): T[] {
  if (v === undefined || v === null) {
    if (o.optional) return [];
    throw bad(`השדה "${field}" הוא חובה`);
  }
  if (!Array.isArray(v)) throw bad(`"${field}" חייב להיות רשימה`);
  if (o.max !== undefined && v.length > o.max) throw bad(`"${field}": עד ${o.max} פריטים`);
  return v as T[];
}
export function obj(v: unknown, field: string): Raw {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw bad(`"${field}" חייב להיות אובייקט`);
  return v as Raw;
}

export function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

// מילים חסומות בסיסיות בפרסום (אפיון סעיף 11) — רשימה מינימלית, מורחבת לפי צורך
const BLOCKED = ["הימורים", "קזינו", "נשק לא חוקי"];
export function assertNotBlocked(text: string, field: string) {
  const hit = BLOCKED.find((w) => text.includes(w));
  if (hit) throw bad(`"${field}" מכיל תוכן שאינו מותר בפלטפורמה`);
}

export function normalizePhone(v: unknown): string {
  const s = String(v || "").replace(/[^\d+]/g, "");
  const local = s.startsWith("+972") ? "0" + s.slice(4) : s.startsWith("972") ? "0" + s.slice(3) : s;
  if (!/^05\d{8}$/.test(local)) throw bad("מספר טלפון נייד ישראלי לא תקין");
  return local;
}
