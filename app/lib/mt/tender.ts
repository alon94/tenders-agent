// ============================================================
// מיני־מכרז — שירותי דומיין משותפים ל-routes: טעינה, בעלות, עיצוב לתצוגה,
// ולידציה לפרסום, ניקוד משוקלל, ואיתור מציעים מתאימים.
// ============================================================
import { dbCount, dbOne, dbSelect } from "./db";
import { forbidden, notFound } from "./http";
import { LIMITS, type BusinessProfileRow, type MtAttachment, type MtItem, type MtProposal, type MtProposalItem, type MtRequirement, type MtTender } from "./types";
import { bad } from "./http";

export async function loadTender(id: string): Promise<MtTender> {
  const t = await dbOne<MtTender>("mt_tenders", `?id=eq.${id}&deleted_at=is.null&select=*`);
  if (!t) throw notFound("המיני־מכרז לא נמצא");
  return t;
}

export function assertBuyer(t: MtTender, profileId: string) {
  if (t.buyer_profile_id !== profileId) throw forbidden("רק העסק שפרסם יכול לבצע פעולה זו");
}

export async function loadItems(tenderId: string) {
  return dbSelect<MtItem>("mt_tender_items", `?tender_id=eq.${tenderId}&order=position.asc&select=*`);
}
export async function loadRequirements(tenderId: string) {
  return dbSelect<MtRequirement>("mt_tender_requirements", `?tender_id=eq.${tenderId}&select=*`);
}
export async function loadAttachments(ownerType: "tender" | "proposal", ownerId: string) {
  return dbSelect<MtAttachment>("mt_attachments", `?owner_type=eq.${ownerType}&owner_id=eq.${ownerId}&order=created_at.asc&select=id,file_name,mime,size_bytes,created_at`);
}

export const isViewerVisibleStatus = (s: MtTender["status"]) => s === "open" || s === "evaluating" || s === "awarded";

/** מה שמציע (או אורח) רואה: בלי תקציב אם הוסתר, בלי זהות אם אנונימי, בלי שדות ניהול. */
export function shapeForViewer(t: MtTender, buyer: BusinessProfileRow | null, opts: { revealBuyer?: boolean } = {}) {
  const anonymous = t.is_anonymous && !opts.revealBuyer;
  return {
    id: t.id, status: t.status, title: t.title, category_ids: t.category_ids, engagement_type: t.engagement_type,
    description: t.description, description_updates: t.description_updates,
    region: t.region, city: t.city, is_remote: t.is_remote,
    budget_min: t.budget_visible ? t.budget_min : null, budget_max: t.budget_visible ? t.budget_max : null,
    budget_visible: t.budget_visible, vat_included: t.vat_included, pricing_mode: t.pricing_mode,
    criteria_weights: t.criteria_weights, payment_terms: t.payment_terms, is_anonymous: t.is_anonymous,
    allow_split_award: t.allow_split_award, deadline_at: t.deadline_at, questions_close_at: t.questions_close_at,
    desired_start_mode: t.desired_start_mode, desired_start: t.desired_start,
    proposal_validity_days: t.proposal_validity_days, proposals_count: t.proposals_count,
    published_at: t.published_at, closed_at: t.closed_at,
    buyer: anonymous
      ? { anonymous: true as const, categories: buyer?.categories || [], region: buyer?.region || null }
      : { anonymous: false as const, profile_id: t.buyer_profile_id, categories: buyer?.categories || [], region: buyer?.region || null, email: opts.revealBuyer ? buyer?.email || null : null },
  };
}

/** בדיקות לפני פרסום (אשף שלבים 1–4). מחזיר רשימת שגיאות בעברית. */
export function validateForPublish(t: MtTender, items: MtItem[]): string[] {
  const errs: string[] = [];
  if (!t.title || t.title.trim().length < 5) errs.push("כותרת (לפחות 5 תווים)");
  if (!t.category_ids?.length) errs.push("תחום");
  if (!t.engagement_type) errs.push("סוג ההתקשרות");
  if (!t.description || t.description.length < LIMITS.descriptionMin) errs.push(`תיאור (לפחות ${LIMITS.descriptionMin} תווים)`);
  if (!t.is_remote && !t.region) errs.push("אזור ביצוע (או «מרחוק»)");
  if (!items.length) errs.push("לפחות שורת דרישה אחת");
  if (items.length > LIMITS.maxItems) errs.push(`עד ${LIMITS.maxItems} שורות דרישה`);
  if (!t.deadline_at) errs.push("מועד אחרון להגשה");
  else {
    const hours = (new Date(t.deadline_at).getTime() - Date.now()) / 3.6e6;
    if (hours < LIMITS.minDeadlineHours) errs.push(`מועד אחרון: לפחות ${LIMITS.minDeadlineHours} שעות מעכשיו`);
    if (hours > LIMITS.maxDeadlineDays * 24) errs.push(`מועד אחרון: עד ${LIMITS.maxDeadlineDays} יום מעכשיו`);
  }
  const w = t.criteria_weights || { price: 0, delivery: 0, experience: 0, quality: 0 };
  if (Math.round(w.price + w.delivery + w.experience + w.quality) !== 100) errs.push("משקלות קריטריוני הבחירה חייבים להסתכם ל-100%");
  return errs;
}

export async function countActiveTenders(profileId: string): Promise<number> {
  return dbCount("mt_tenders", `?buyer_profile_id=eq.${profileId}&status=in.(draft,open,evaluating)&deleted_at=is.null`);
}

export function assertCanCreate(active: number) {
  if (active >= LIMITS.maxActiveTenders) {
    throw bad(`אפשר להחזיק עד ${LIMITS.maxActiveTenders} מיני־מכרזים פעילים. סיימו או בטלו אחד כדי לפתוח חדש`, "limit_active");
  }
}

// ---------- ניקוד משוקלל (אפיון מוצרי סעיף 4.5) ----------
// מחיר: היחס בין ההצעה הזולה להצעה (זולה=100). אספקה: הקצרה=100. ניסיון/איכות:
// הצהרת ניסיון + עמידה בדרישות סף (100 אם הכול, אחרת 60/30). כל רכיב × משקלו.
export function scoreProposals(t: MtTender, proposals: MtProposal[], meetsAll: Map<string, boolean>): Map<string, number> {
  const w = t.criteria_weights;
  const priced = proposals.filter((p) => p.total != null && p.total > 0);
  const minTotal = Math.min(...priced.map((p) => Number(p.total)));
  const days = (p: MtProposal) => p.delivery_value == null ? null : p.delivery_unit === "weeks" ? p.delivery_value * 7 : p.delivery_value;
  const withDays = proposals.map(days).filter((d): d is number => d != null && d > 0);
  const minDays = withDays.length ? Math.min(...withDays) : null;
  const out = new Map<string, number>();
  for (const p of proposals) {
    const priceScore = p.total && p.total > 0 && Number.isFinite(minTotal) ? (minTotal / Number(p.total)) * 100 : 0;
    const d = days(p);
    const deliveryScore = d && minDays ? (minDays / d) * 100 : 50;
    const expScore = (p.experience_text ? 70 : 30) + (p.experience_links?.length ? 30 : 0);
    const qualScore = meetsAll.get(p.id) === true ? 100 : meetsAll.get(p.id) === false ? 30 : 60;
    const total = (priceScore * w.price + deliveryScore * w.delivery + expScore * w.experience + qualScore * w.quality) / 100;
    out.set(p.id, Math.round(total * 10) / 10);
  }
  return out;
}

export function sumItems(items: MtProposalItem[]): number {
  return items.filter((i) => !i.is_declined).reduce((s, i) => s + Number(i.line_total || 0), 0);
}

/** עסקים רשומים שמתאימים למיני־מכרז לפי תחום (ואזור, אלא אם מרחוק). */
export async function matchingProfiles(t: MtTender): Promise<BusinessProfileRow[]> {
  if (!t.category_ids?.length) return [];
  const cats = `{${t.category_ids.join(",")}}`;
  let q = `?categories=ov.${encodeURIComponent(cats)}&user_id=neq.${t.buyer_profile_id}&mt_notify_mode=neq.off&select=user_id,email,categories,region,mt_notify_mode`;
  if (!t.is_remote && t.region) q += `&region=eq.${encodeURIComponent(t.region)}`;
  const rows = await dbSelect<BusinessProfileRow>("business_profiles", q);
  const blocked = new Set(t.blocked_profile_ids || []);
  return rows.filter((r) => !blocked.has(r.user_id));
}
