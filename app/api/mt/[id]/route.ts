// /api/mt/[id] — GET: צפייה (מעוצבת לפי תפקיד) · PATCH: שמירת טיוטה / עריכה מוגבלת אחרי פרסום
import { requireActor } from "@/app/lib/mt/auth";
import { dbDelete, dbInsert, dbOne, dbSelect, dbUpdate } from "@/app/lib/mt/db";
import { logEvent, notifyMany } from "@/app/lib/mt/events";
import { bad, conflict, forbidden, handle, ok, readJson, type Params } from "@/app/lib/mt/http";
import { isViewerVisibleStatus, loadAttachments, loadItems, loadRequirements, loadTender, shapeForViewer } from "@/app/lib/mt/tender";
import { ENGAGEMENT_TYPES, LIMITS, PAYMENT_TERMS, PRICING_MODES, REQ_KINDS, UNITS, type BusinessProfileRow, type MtProposal, type MtQuestion } from "@/app/lib/mt/types";
import { arr, assertNotBlocked, bool, isoDate, num, obj, oneOf, str, uuid, type Raw } from "@/app/lib/mt/validate";
import { DOMAINS } from "@/app/lib/domains";

export const dynamic = "force-dynamic";
const CATEGORY_IDS = new Set(DOMAINS.map((d) => d.id));

export const GET = handle(async (req, ctx: Params<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await requireActor(req);
  const t = await loadTender(id);
  const pid = actor.profile?.user_id || null;
  const isBuyer = pid === t.buyer_profile_id;
  if (!isBuyer && !isViewerVisibleStatus(t.status)) throw forbidden("המיני־מכרז אינו זמין לצפייה");
  if (!isBuyer && pid && t.blocked_profile_ids.includes(pid)) throw forbidden("המיני־מכרז אינו זמין לצפייה");

  const [items, reqs, files, buyer] = await Promise.all([
    loadItems(id), loadRequirements(id), loadAttachments("tender", id),
    dbOne<BusinessProfileRow>("business_profiles", `?user_id=eq.${t.buyer_profile_id}&select=user_id,email,categories,region`),
  ]);
  const questions = await dbSelect<MtQuestion>(
    isBuyer ? "mt_questions" : "mt_questions_public",
    `?tender_id=eq.${id}&order=created_at.asc&select=*`,
  );

  if (isBuyer) {
    return ok({ role: "buyer", tender: t, items, requirements: reqs, files, questions, buyer });
  }
  // מציע: העותק המסונן + ההצעה שלו אם קיימת
  const myProposal = pid
    ? await dbOne<MtProposal>("mt_proposals", `?tender_id=eq.${id}&bidder_profile_id=eq.${pid}&status=neq.withdrawn&select=*`)
    : null;
  const won = myProposal?.status === "won";
  return ok({
    role: "bidder",
    tender: shapeForViewer(t, buyer, { revealBuyer: won }),
    items, requirements: reqs, files, questions, myProposal,
  });
});

// שדות המותרים לעריכה בטיוטה
function draftPatch(b: Raw) {
  const p: Record<string, unknown> = {};
  if ("title" in b) { p.title = str(b.title, "כותרת", { max: LIMITS.titleMax, optional: true }) ?? ""; if (p.title) assertNotBlocked(p.title as string, "כותרת"); }
  if ("category_ids" in b) {
    const ids = arr<string>(b.category_ids, "תחומים", { max: 2 });
    for (const c of ids) if (!CATEGORY_IDS.has(c)) throw bad("תחום לא מוכר: " + c);
    p.category_ids = ids;
  }
  if ("engagement_type" in b) p.engagement_type = oneOf(b.engagement_type, "סוג התקשרות", ENGAGEMENT_TYPES, { optional: true });
  if ("description" in b) { p.description = str(b.description, "תיאור", { max: LIMITS.descriptionMax, optional: true }); if (p.description) assertNotBlocked(p.description as string, "תיאור"); }
  if ("region" in b) p.region = str(b.region, "אזור", { max: 60, optional: true });
  if ("city" in b) p.city = str(b.city, "עיר", { max: 60, optional: true });
  if ("is_remote" in b) p.is_remote = bool(b.is_remote, "מרחוק", false);
  if ("budget_min" in b) p.budget_min = num(b.budget_min, "תקציב מ-", { min: 0, optional: true });
  if ("budget_max" in b) p.budget_max = num(b.budget_max, "תקציב עד", { min: 0, optional: true });
  if ("budget_visible" in b) p.budget_visible = bool(b.budget_visible, "תקציב גלוי", true);
  if ("vat_included" in b) p.vat_included = bool(b.vat_included, "כולל מע״מ", false);
  if ("pricing_mode" in b) p.pricing_mode = oneOf(b.pricing_mode, "אופן תמחור", PRICING_MODES) ?? "fixed";
  if ("criteria_weights" in b) {
    const w = obj(b.criteria_weights, "משקלות");
    p.criteria_weights = {
      price: num(w.price, "משקל מחיר", { min: 0, max: 100 }), delivery: num(w.delivery, "משקל אספקה", { min: 0, max: 100 }),
      experience: num(w.experience, "משקל ניסיון", { min: 0, max: 100 }), quality: num(w.quality, "משקל איכות", { min: 0, max: 100 }),
    };
  }
  if ("payment_terms" in b) p.payment_terms = oneOf(b.payment_terms, "תנאי תשלום", PAYMENT_TERMS, { optional: true });
  if ("is_anonymous" in b) p.is_anonymous = bool(b.is_anonymous, "אנונימי", false);
  if ("allow_split_award" in b) p.allow_split_award = bool(b.allow_split_award, "פיצול זכייה", false);
  if ("deadline_at" in b) p.deadline_at = isoDate(b.deadline_at, "מועד אחרון", { optional: true });
  if ("questions_close_at" in b) p.questions_close_at = isoDate(b.questions_close_at, "סיום שאלות", { optional: true });
  if ("desired_start_mode" in b) p.desired_start_mode = oneOf(b.desired_start_mode, "תחילת עבודה", ["asap", "date", "flexible"] as const, { optional: true });
  if ("desired_start" in b) p.desired_start = b.desired_start ? isoDate(b.desired_start, "תאריך התחלה")!.slice(0, 10) : null;
  if ("proposal_validity_days" in b) p.proposal_validity_days = num(b.proposal_validity_days, "תוקף הצעות", { min: 1, max: 365, int: true });
  if ("public_link_enabled" in b) p.public_link_enabled = bool(b.public_link_enabled, "קישור ציבורי", false);
  if ("blocked_profile_ids" in b) p.blocked_profile_ids = arr<string>(b.blocked_profile_ids, "חסומים", { max: 50 }).map((x) => uuid(x, "מזהה עסק חסום"));
  return p;
}

export const PATCH = handle(async (req, ctx: Params<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await requireActor(req);
  const t = await loadTender(id);
  if (!actor.profile || actor.profile.user_id !== t.buyer_profile_id) throw forbidden();
  const b = await readJson<Raw>(req);

  if (t.status === "draft") {
    const patch = draftPatch(b);
    // שורות דרישה ודרישות סף מגיעות כמערכים מלאים (החלפה)
    if ("items" in b) {
      const items = arr<Raw>(b.items, "שורות דרישה", { max: LIMITS.maxItems }).map((it, i) => ({
        tender_id: id, position: i + 1,
        description: str(it.description, `שורה ${i + 1}`, { min: 2, max: 200 }),
        quantity: num(it.quantity, `כמות בשורה ${i + 1}`, { min: 0.01 }),
        unit: oneOf(it.unit, `יחידה בשורה ${i + 1}`, UNITS) ?? "lump_sum",
        is_optional: bool(it.is_optional, "אופציונלי", false),
      }));
      await dbDelete("mt_tender_items", `?tender_id=eq.${id}`);
      if (items.length) await dbInsert("mt_tender_items", items);
    }
    if ("requirements" in b) {
      const reqs = arr<Raw>(b.requirements, "דרישות סף", { max: 15 }).map((r) => ({
        tender_id: id, kind: oneOf(r.kind, "סוג דרישה", REQ_KINDS), label: str(r.label, "דרישה", { min: 2, max: 160 }),
        value: r.value ?? null, is_mandatory: bool(r.is_mandatory, "חובה", false),
      }));
      await dbDelete("mt_tender_requirements", `?tender_id=eq.${id}`);
      if (reqs.length) await dbInsert("mt_tender_requirements", reqs);
    }
    if (Object.keys(patch).length) await dbUpdate("mt_tenders", `?id=eq.${id}`, patch);
    return ok({ ok: true });
  }

  if (t.status === "open") {
    // אחרי פרסום: רק תוספת לתיאור (מסומנת כעדכון) ושינוי קישור ציבורי/חסומים
    const patch: Record<string, unknown> = {};
    if ("description_update" in b) {
      const text = str(b.description_update, "עדכון לתיאור", { min: 5, max: 1500 })!;
      assertNotBlocked(text, "עדכון");
      patch.description_updates = [...(t.description_updates || []), { at: new Date().toISOString(), text }];
      const bidders = await dbSelect<{ bidder_profile_id: string }>("mt_proposals", `?tender_id=eq.${id}&status=eq.submitted&select=bidder_profile_id`);
      await notifyMany(bidders.map((x) => x.bidder_profile_id), "mt_clarification", id, null,
        `עדכון במיני־מכרז "${t.title}"`, text, `/mt/${id}`);
    }
    if ("public_link_enabled" in b) patch.public_link_enabled = bool(b.public_link_enabled, "קישור ציבורי", false);
    if ("blocked_profile_ids" in b) patch.blocked_profile_ids = arr<string>(b.blocked_profile_ids, "חסומים", { max: 50 }).map((x) => uuid(x, "מזהה"));
    if (!Object.keys(patch).length) throw bad("אחרי הפרסום אפשר רק להוסיף עדכון לתיאור, לשנות קישור ציבורי או חסימות");
    await dbUpdate("mt_tenders", `?id=eq.${id}`, patch);
    await logEvent(id, null, actor.userId, "buyer", "mt_edited_after_publish", { fields: Object.keys(patch) });
    return ok({ ok: true });
  }
  throw conflict("המיני־מכרז כבר אינו ניתן לעריכה");
});
