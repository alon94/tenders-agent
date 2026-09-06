// ============================================================
// מיני־מכרז — שכבת לקוח (דפדפן): קריאות ל-/api/mt/* עם טוקן המשתמש,
// תוויות בעברית לכל ה-enum-ים, ועזרי פורמט. משמש את כל דפי /mt.
// ============================================================
'use client';

import { getValidSession } from '../authClient';
import type {
  MtClosedReason, MtEngagementType, MtPaymentTerms, MtPricingMode, MtProposalStatus,
  MtReqKind, MtTenderStatus, MtUnit,
} from './types';

export class MtClientError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** קריאה ל-API של המיני־מכרזים. זורק MtClientError עם ההודעה בעברית מהשרת. */
export async function mtFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.auth !== false) {
    const session = await getValidSession();
    if (!session) throw new MtClientError(401, 'unauthorized', 'נדרשת התחברות');
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const res = await fetch(`/api/mt${path}`, {
    method: init.method || 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new MtClientError(res.status, err?.code || 'error', err?.message || `שגיאה (${res.status})`);
  }
  return data as T;
}

export function errMessage(e: unknown): string {
  if (e instanceof MtClientError) return e.message;
  if (e instanceof Error) return e.message;
  return 'שגיאה לא צפויה';
}

// ---------- תוויות ----------
export const STATUS_LABEL: Record<MtTenderStatus, string> = {
  draft: 'טיוטה', open: 'פתוח להצעות', evaluating: 'בבחירה', awarded: 'נבחר זוכה', no_award: 'נסגר ללא בחירה',
  cancelled: 'בוטל', expired: 'פג — ללא הצעות', completed: 'הושלם', archived: 'בארכיון',
};
export const STATUS_COLOR: Record<MtTenderStatus, { fg: string; bg: string }> = {
  draft: { fg: '#5f6c7a', bg: '#eef1f4' }, open: { fg: '#0E84B5', bg: '#E5F5FC' }, evaluating: { fg: '#B45309', bg: '#FEF3C7' },
  awarded: { fg: '#0D9488', bg: '#CCFBF1' }, no_award: { fg: '#5f6c7a', bg: '#eef1f4' }, cancelled: { fg: '#B91C1C', bg: '#FEE2E2' },
  expired: { fg: '#5f6c7a', bg: '#eef1f4' }, completed: { fg: '#0D9488', bg: '#CCFBF1' }, archived: { fg: '#5f6c7a', bg: '#eef1f4' },
};
export const PROPOSAL_STATUS_LABEL: Record<MtProposalStatus, string> = {
  draft: 'טיוטה', submitted: 'הוגשה', withdrawn: 'נמשכה', won: 'זכייה', lost: 'לא נבחרה', expired: 'פגה',
};
export const ENGAGEMENT_LABEL: Record<MtEngagementType, string> = {
  one_time: 'שירות חד־פעמי', project: 'פרויקט', retainer: 'התקשרות מתמשכת (ריטיינר)', goods: 'רכש מוצרים',
};
export const PRICING_LABEL: Record<MtPricingMode, string> = {
  fixed: 'מחיר קבוע', hourly: 'לפי שעה', per_unit: 'לפי יחידה', bidder_choice: 'לפי הצעת המציע',
};
export const UNIT_LABEL: Record<MtUnit, string> = {
  unit: 'יח׳', hour: 'שעה', sqm: 'מ״ר', month: 'חודש', lump_sum: 'קומפלט', other: 'אחר',
};
export const PAYMENT_LABEL: Record<MtPaymentTerms, string> = {
  net30: 'שוטף + 30', net60: 'שוטף + 60', advance_final: 'מקדמה + סיום', milestones: 'לפי אבני דרך', other: 'אחר',
};
export const REQ_KIND_LABEL: Record<MtReqKind, string> = {
  licensed_dealer: 'עוסק מורשה / חברה', insurance: 'ביטוח בתוקף', professional_license: 'רישיון מקצועי',
  years_experience: 'ניסיון של X שנים', references: 'המלצות', custom: 'דרישה אחרת',
};
export const CLOSED_REASON_LABEL: Record<MtClosedReason, string> = {
  found_elsewhere: 'נמצא ספק בדרך אחרת', need_cancelled: 'הצורך בוטל', mistake: 'טעות בפרסום', no_decision: 'לא התקבלה החלטה', other: 'אחר',
};
export const CRITERIA_LABEL = { price: 'מחיר', delivery: 'זמן אספקה', experience: 'ניסיון והמלצות', quality: 'איכות ההצעה' } as const;

export const REGIONS = [
  { value: 'national', label: 'ארצי' },
  { value: 'north', label: 'צפון' },
  { value: 'haifa', label: 'חיפה' },
  { value: 'center', label: 'מרכז' },
  { value: 'tlv', label: 'תל אביב' },
  { value: 'south', label: 'דרום' },
  { value: 'jerusalem', label: 'ירושלים' },
];
export function regionLabel(v: string | null | undefined): string {
  if (!v) return '';
  return REGIONS.find((r) => r.value === v)?.label || (v === 'all' ? 'כל הארץ' : v);
}

// ---------- פורמט ----------
const TZ = 'Asia/Jerusalem';
export function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const x = new Date(d);
  return isNaN(x.getTime()) ? '—' : x.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ });
}
export function fmtDateTime(d?: string | null): string {
  if (!d) return '—';
  const x = new Date(d);
  return isNaN(x.getTime()) ? '—' : x.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ });
}
export function fmtMoney(n?: number | null, opts: { dash?: boolean } = {}): string {
  if (n == null || isNaN(Number(n))) return opts.dash === false ? '' : '—';
  return `${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 })} ₪`;
}
export function fmtBudget(min?: number | null, max?: number | null): string {
  if (min == null && max == null) return 'לא צוין';
  if (min != null && max != null) return `${fmtMoney(min)} – ${fmtMoney(max)}`;
  if (min != null) return `מ-${fmtMoney(min)}`;
  return `עד ${fmtMoney(max)}`;
}
/** «עוד 3 ימים ו-4 שעות» / «עבר» */
export function timeLeft(d?: string | null): string {
  if (!d) return '';
  const ms = new Date(d).getTime() - Date.now();
  if (ms <= 0) return 'המועד עבר';
  const h = Math.floor(ms / 3.6e6);
  const days = Math.floor(h / 24);
  const hrs = h % 24;
  if (days >= 2) return `עוד ${days} ימים`;
  if (days === 1) return `עוד יום ו-${hrs} שעות`;
  if (h >= 1) return `עוד ${h} שעות`;
  return `עוד ${Math.max(1, Math.floor(ms / 6e4))} דקות`;
}
/** datetime-local ⇄ ISO (בשעון המקומי של הדפדפן) */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
/** ברירת מחדל למועד אחרון: +5 ימי עבודה ב-12:00 */
export function defaultDeadline(): string {
  const d = new Date();
  let added = 0;
  while (added < 5) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 5 && wd !== 6) added++;
  }
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}
export function isWeekend(iso?: string | null): boolean {
  if (!iso) return false;
  const wd = new Date(iso).getDay();
  return wd === 5 || wd === 6;
}

// ---------- העלאת קבצים (חתימה → PUT ל-Storage → אישור) ----------
export async function uploadMtFile(ownerType: 'tender' | 'proposal', ownerId: string, file: File): Promise<{ id: string }> {
  const meta = { owner_type: ownerType, owner_id: ownerId, file_name: file.name, mime: file.type || 'application/octet-stream', size: file.size };
  const signed = await mtFetch<{ path: string; upload_url: string; token: string; method: string }>('/upload', { method: 'POST', body: meta });
  const put = await fetch(signed.upload_url, { method: 'PUT', headers: { 'Content-Type': meta.mime, 'x-upsert': 'false' }, body: file });
  if (!put.ok) throw new MtClientError(put.status, 'upload', 'ההעלאה לאחסון נכשלה');
  return mtFetch<{ id: string }>('/upload?confirm=1', { method: 'POST', body: { ...meta, path: signed.path } });
}

/** פתיחת קובץ מצורף בחלון חדש דרך קישור חתום */
export async function openMtFile(fileId: string) {
  const r = await mtFetch<{ url: string }>(`/files/${fileId}?json=1`);
  window.open(r.url, '_blank', 'noopener');
}
