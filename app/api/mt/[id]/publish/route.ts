// /api/mt/[id]/publish — טיוטה → פתוח. ולידציה מלאה, הזמנות, התראות התאמה.
import { waitUntil } from "@vercel/functions";
import { requireCompleteProfile } from "@/app/lib/mt/auth";
import { dbInsert, dbUpdate } from "@/app/lib/mt/db";
import { logEvent, notify, notifyMany } from "@/app/lib/mt/events";
import { bad, conflict, handle, ok, readJson, type Params } from "@/app/lib/mt/http";
import { dispatchEmailQueue, sendInviteEmails } from "@/app/lib/mt/mailer";
import { assertBuyer, assertCanCreate, countActiveTenders, loadItems, loadTender, matchingProfiles, validateForPublish } from "@/app/lib/mt/tender";
import { LIMITS, type MtInvitation, type MtTender } from "@/app/lib/mt/types";
import { arr, str, type Raw } from "@/app/lib/mt/validate";

export const dynamic = "force-dynamic";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tenders-agent.vercel.app";

export const POST = handle(async (req, ctx: Params<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await requireCompleteProfile(req);
  const t = await loadTender(id);
  assertBuyer(t, actor.profile.user_id);
  if (t.status !== "draft") throw conflict("המיני־מכרז כבר פורסם");
  const b = await readJson<Raw>(req).catch(() => ({} as Raw));

  const items = await loadItems(id);
  const errs = validateForPublish(t, items);
  if (errs.length) throw bad("חסר לפני פרסום: " + errs.join(" · "), "incomplete");
  if (b.accept_terms !== true) throw bad("יש לאשר את תנאי השימוש למיני־מכרזים", "terms");
  // הטיוטה עצמה נספרת בפעילים — לכן הסף כאן הוא הכמות *כולל* אותה
  const active = await countActiveTenders(actor.profile.user_id);
  assertCanCreate(active - 1);

  const questionsClose = t.questions_close_at
    ?? new Date(new Date(t.deadline_at!).getTime() - LIMITS.questionsCloseBeforeHours * 3.6e6).toISOString();
  const [updated] = await dbUpdate<MtTender>("mt_tenders", `?id=eq.${id}`, {
    status: "open", questions_close_at: questionsClose, published_at: new Date().toISOString(),
    public_link_enabled: b.public_link_enabled === true,
  });

  // הזמנות ישירות (אופציונלי בגוף הבקשה)
  const invites = arr<Raw>(b.invitations, "הזמנות", { max: LIMITS.maxInvitations, optional: true }).map((i) => ({
    tender_id: id, kind: "direct" as const,
    invitee_name: str(i.name, "שם מוזמן", { max: 80, optional: true }),
    invitee_email: str(i.email, "מייל מוזמן", { max: 120, optional: true })?.toLowerCase() ?? null,
    invitee_phone: str(i.phone, "טלפון מוזמן", { max: 20, optional: true }),
  })).filter((i) => i.invitee_email || i.invitee_phone);
  let created: MtInvitation[] = [];
  if (invites.length) created = await dbInsert<MtInvitation>("mt_invitations", invites);
  if (b.public_link_enabled === true) {
    await dbInsert("mt_invitations", { tender_id: id, kind: "public_link", token: updated.public_token });
  }

  // התראות התאמה לעסקים רשומים — לפי תחום ואזור
  const matches = await matchingProfiles(updated);
  await notifyMany(matches.map((m) => m.user_id), "mt_match", id, null,
    `הזדמנות חדשה: ${updated.title}`,
    `מיני־מכרז בתחום שלכם${updated.region ? " באזור " + updated.region : ""}. מועד אחרון: ${new Date(updated.deadline_at!).toLocaleDateString("he-IL")}.`,
    `/mt/${id}`);
  await notify(actor.profile.user_id, "mt_published", id, null, `המיני־מכרז "${updated.title}" פורסם`,
    `ההתראה נשלחה ל-${matches.length} עסקים רשומים. קישור לשיתוף: ${SITE}/mt/i/${updated.public_token}`, `/mt/${id}/manage`);

  await logEvent(id, null, actor.userId, "buyer", "mt_published", {
    items_count: items.length, invites_count: created.length, matched: matches.length,
    budget_visible: updated.budget_visible, is_anonymous: updated.is_anonymous,
  });
  const inviterLabel = updated.is_anonymous ? "עסק בפלטפורמת שווה מכרזים" : (actor.email || "עסק בפלטפורמה");
  waitUntil(Promise.all([dispatchEmailQueue(100), sendInviteEmails(updated, created, inviterLabel)]).catch(() => undefined));

  return ok({
    status: "open", matched: matches.length,
    public_link: updated.public_link_enabled ? `${SITE}/mt/i/${updated.public_token}` : null,
    invitations: created.map((c) => ({ id: c.id, email: c.invitee_email, phone: c.invitee_phone, link: `${SITE}/mt/i/${c.token}` })),
  });
});
