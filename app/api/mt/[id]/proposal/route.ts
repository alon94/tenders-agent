// /api/mt/[id]/proposal — PUT: יצירה/עדכון ההצעה שלי (עד המועד) · GET: ההצעה שלי
import { waitUntil } from "@vercel/functions";
import { requireProfile } from "@/app/lib/mt/auth";
import { dbCount, dbDelete, dbInsert, dbOne, dbSelect, dbUpdate } from "@/app/lib/mt/db";
import { logEvent, notify } from "@/app/lib/mt/events";
import { bad, conflict, forbidden, handle, ok, readJson, type Params } from "@/app/lib/mt/http";
import { dispatchEmailQueue } from "@/app/lib/mt/mailer";
import { loadAttachments, loadItems, loadRequirements, loadTender } from "@/app/lib/mt/tender";
import type { MtInvitation, MtProposal, MtProposalItem } from "@/app/lib/mt/types";
import { arr, bool, isoDate, num, oneOf, str, uuid, type Raw } from "@/app/lib/mt/validate";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, ctx: Params<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await requireProfile(req);
  const p = await dbOne<MtProposal>("mt_proposals", `?tender_id=eq.${id}&bidder_profile_id=eq.${actor.profile.user_id}&status=neq.withdrawn&select=*`);
  if (!p) return ok({ proposal: null });
  const [items, answers, files] = await Promise.all([
    dbSelect<MtProposalItem>("mt_proposal_items", `?proposal_id=eq.${p.id}&select=*`),
    dbSelect("mt_proposal_req_answers", `?proposal_id=eq.${p.id}&select=*`),
    loadAttachments("proposal", p.id),
  ]);
  return ok({ proposal: p, items, requirement_answers: answers, files });
});

export const PUT = handle(async (req, ctx: Params<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await requireProfile(req);
  const pid = actor.profile.user_id;
  const t = await loadTender(id);
  if (t.buyer_profile_id === pid) throw forbidden("אי אפשר להגיש הצעה למיני־מכרז שלכם");
  if (t.blocked_profile_ids.includes(pid)) throw forbidden("המיני־מכרז אינו זמין לכם");
  if (t.status !== "open") throw conflict("המיני־מכרז אינו פתוח להגשות", "not_open");
  if (!t.deadline_at || new Date(t.deadline_at).getTime() <= Date.now()) {
    throw conflict(`ההגשה נסגרה ב-${t.deadline_at ? new Date(t.deadline_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }) : "המועד האחרון"}`, "deadline_passed");
  }
  const b = await readJson<Raw>(req);
  const [tenderItems, reqs] = await Promise.all([loadItems(id), loadRequirements(id)]);

  // --- שורות ---
  const rawItems = arr<Raw>(b.items, "תמחור שורות");
  const byItem = new Map(tenderItems.map((i) => [i.id, i]));
  const items = rawItems.map((r) => {
    const tid = uuid(r.tender_item_id, "שורת דרישה")!;
    const ti = byItem.get(tid);
    if (!ti) throw bad("שורת דרישה לא שייכת למיני־מכרז זה");
    const declined = bool(r.is_declined, "לא מציע", false);
    const unit_price = declined ? null : num(r.unit_price, `מחיר ליחידה — ${ti.description}`, { min: 0 });
    return { tender_item_id: tid, quantity: Number(ti.quantity), unit_price, is_declined: declined,
      line_total: declined || unit_price == null ? 0 : Math.round(unit_price * Number(ti.quantity) * 100) / 100 };
  });
  for (const ti of tenderItems) {
    const got = items.find((i) => i.tender_item_id === ti.id);
    if (!got) throw bad(`חסר תמחור לשורה: ${ti.description}`);
    if (got.is_declined && !ti.is_optional) throw bad(`השורה "${ti.description}" אינה אופציונלית — יש לתמחר אותה`);
  }
  const subtotal = Math.round(items.reduce((s, i) => s + i.line_total, 0) * 100) / 100;
  if (subtotal <= 0) throw bad("סכום ההצעה חייב להיות גדול מאפס");
  const discount_type = oneOf(b.discount_type, "סוג הנחה", ["percent", "amount"] as const, { optional: true });
  const discount_value = discount_type ? num(b.discount_value, "הנחה", { min: 0, max: discount_type === "percent" ? 100 : subtotal })! : 0;
  const total = discount_type === "percent" ? Math.round(subtotal * (1 - discount_value / 100) * 100) / 100
    : discount_type === "amount" ? subtotal - discount_value : subtotal;

  // --- אספקה, תוקף, טקסטים ---
  const delivery_date = isoDate(b.delivery_date, "תאריך אספקה", { optional: true });
  const delivery_value = num(b.delivery_value, "זמן אספקה", { min: 1, max: 730, int: true, optional: !!delivery_date });
  const delivery_unit = delivery_value != null ? oneOf(b.delivery_unit, "יחידת זמן", ["days", "weeks"] as const)! : null;
  const validity_days = num(b.validity_days, "תוקף ההצעה", { min: t.proposal_validity_days, max: 365, int: true, optional: true }) ?? t.proposal_validity_days;
  const experience_text = str(b.experience_text, "ניסיון", { max: 1000, optional: true });
  const experience_links = arr<string>(b.experience_links, "קישורים", { max: 3, optional: true }).map((l) => str(l, "קישור", { max: 300 })!);
  const notes = str(b.notes, "הערות", { max: 2000, optional: true });
  if (b.declaration !== true) throw bad("יש לאשר את ההצהרה בסוף הטופס", "declaration");

  // --- דרישות סף ---
  const rawAns = arr<Raw>(b.requirement_answers, "דרישות סף", { optional: true });
  const answers = reqs.map((r) => {
    const a = rawAns.find((x) => x.requirement_id === r.id);
    if (!a) throw bad(`חסרה תשובה לדרישה: ${r.label}`);
    return { requirement_id: r.id, meets: bool(a.meets, r.label), note: str(a.note, "הערה", { max: 300, optional: true }) };
  });

  // --- הזמנה (אם הגיע דרכה) ---
  const inviteToken = str(b.invite_token, "טוקן הזמנה", { max: 64, optional: true });
  const invitation = inviteToken ? await dbOne<MtInvitation>("mt_invitations", `?tender_id=eq.${id}&token=eq.${inviteToken}&select=id,status`) : null;

  const existing = await dbOne<MtProposal>("mt_proposals", `?tender_id=eq.${id}&bidder_profile_id=eq.${pid}&status=neq.withdrawn&select=*`);
  const now = new Date().toISOString();
  const row = {
    tender_id: id, bidder_profile_id: pid, submitted_by_user_id: actor.userId, invitation_id: invitation?.id ?? existing?.invitation_id ?? null,
    status: "submitted", sealed_until: t.deadline_at, subtotal, discount_type, discount_value, total, vat_included: t.vat_included,
    delivery_value, delivery_unit, delivery_date: delivery_date ? delivery_date.slice(0, 10) : null, validity_days,
    experience_text, experience_links, notes, declaration_accepted_at: now, last_updated_at: now,
    first_submitted_at: existing?.first_submitted_at ?? now,
  };

  let proposal: MtProposal;
  if (existing) {
    [proposal] = await dbUpdate<MtProposal>("mt_proposals", `?id=eq.${existing.id}`, row);
    await dbDelete("mt_proposal_items", `?proposal_id=eq.${existing.id}`);
    await dbDelete("mt_proposal_req_answers", `?proposal_id=eq.${existing.id}`);
  } else {
    [proposal] = await dbInsert<MtProposal>("mt_proposals", row);
  }
  await dbInsert("mt_proposal_items", items.map((i) => ({ ...i, proposal_id: proposal.id })));
  if (answers.length) await dbInsert("mt_proposal_req_answers", answers.map((a) => ({ ...a, proposal_id: proposal.id })));

  // snapshot לגרסה
  const revision_no = (await dbCount("mt_proposal_revisions", `?proposal_id=eq.${proposal.id}`)) + 1;
  await dbInsert("mt_proposal_revisions", { proposal_id: proposal.id, revision_no, snapshot: { ...row, items, answers } });
  if (invitation && invitation.status !== "submitted") await dbUpdate("mt_invitations", `?id=eq.${invitation.id}`, { status: "submitted" });

  const isNew = !existing;
  await logEvent(id, proposal.id, actor.userId, "bidder", isNew ? "mt_proposal_submitted" : "mt_proposal_updated", { total, items_priced: items.filter((i) => !i.is_declined).length, revision_no });
  if (isNew) {
    await notify(t.buyer_profile_id, "mt_proposal_received", id, null, `התקבלה הצעה חדשה ל"${t.title}"`,
      `סה"כ הצעות עד כה: ${t.proposals_count + 1}. הפרטים ייחשפו במועד האחרון.`, `/mt/${id}/manage`);
  }
  await notify(pid, "mt_proposal_submitted", id, proposal.id, `ההצעה שלכם ל"${t.title}" ${isNew ? "נקלטה" : "עודכנה"}`,
    `סה"כ ${total.toLocaleString("he-IL")} ₪ (${t.vat_included ? "כולל" : "לפני"} מע"מ). ההצעה חתומה עד ${new Date(t.deadline_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })} — אפשר לערוך או למשוך עד אז.`, `/mt/${id}`);
  waitUntil(dispatchEmailQueue().catch(() => undefined));
  return ok({ id: proposal.id, revision_no, total, status: proposal.status }, isNew ? 201 : 200);
});
