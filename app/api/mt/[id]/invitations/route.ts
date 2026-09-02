// /api/mt/[id]/invitations — GET: רשימה וסטטוסים · POST: הוספת מוזמנים · DELETE ?id= ביטול הזמנה
import { waitUntil } from "@vercel/functions";
import { requireProfile } from "@/app/lib/mt/auth";
import { dbCount, dbInsert, dbSelect, dbUpdate } from "@/app/lib/mt/db";
import { logEvent, notify } from "@/app/lib/mt/events";
import { bad, conflict, handle, ok, readJson, type Params } from "@/app/lib/mt/http";
import { sendInviteEmails } from "@/app/lib/mt/mailer";
import { assertBuyer, loadTender } from "@/app/lib/mt/tender";
import { LIMITS, type BusinessProfileRow, type MtInvitation } from "@/app/lib/mt/types";
import { arr, str, uuid, type Raw } from "@/app/lib/mt/validate";

export const dynamic = "force-dynamic";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tenders-agent.vercel.app";

export const GET = handle(async (req, ctx: Params<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await requireProfile(req);
  const t = await loadTender(id);
  assertBuyer(t, actor.profile.user_id);
  const rows = await dbSelect<MtInvitation>("mt_invitations", `?tender_id=eq.${id}&order=sent_at.asc&select=*`);
  return ok({
    public_link: t.public_link_enabled ? `${SITE}/mt/i/${t.public_token}` : null,
    invitations: rows.filter((r) => r.kind === "direct").map((r) => ({ ...r, link: `${SITE}/mt/i/${r.token}` })),
  });
});

export const POST = handle(async (req, ctx: Params<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await requireProfile(req);
  const t = await loadTender(id);
  assertBuyer(t, actor.profile.user_id);
  if (t.status !== "open" && t.status !== "draft") throw conflict("אפשר להזמין רק למיני־מכרז פתוח");
  const b = await readJson<Raw>(req);
  const existing = await dbCount("mt_invitations", `?tender_id=eq.${id}&kind=eq.direct`);
  const list = arr<Raw>(b.list, "מוזמנים", { max: LIMITS.maxInvitations }).map((i) => ({
    tender_id: id, kind: "direct" as const,
    invitee_name: str(i.name, "שם", { max: 80, optional: true }),
    invitee_email: str(i.email, "מייל", { max: 120, optional: true })?.toLowerCase() ?? null,
    invitee_phone: str(i.phone, "טלפון", { max: 20, optional: true }),
  })).filter((i) => i.invitee_email || i.invitee_phone);
  if (!list.length) throw bad("יש להזין לפחות מייל או טלפון אחד");
  if (existing + list.length > LIMITS.maxInvitations) throw bad(`עד ${LIMITS.maxInvitations} הזמנות ישירות למיני־מכרז`);

  // מיילים שכבר רשומים בפלטפורמה → מקושרים לפרופיל ומקבלים גם התראה פנימית
  const emails = list.map((l) => l.invitee_email).filter((e): e is string => !!e);
  const known = emails.length
    ? await dbSelect<BusinessProfileRow>("business_profiles", `?email=in.(${emails.map((e) => `"${e}"`).join(",")})&select=user_id,email`)
    : [];
  const byEmail = new Map(known.map((k) => [String(k.email).toLowerCase(), k.user_id]));
  const rows = list.map((l) => ({ ...l, invitee_profile_id: l.invitee_email ? byEmail.get(l.invitee_email) ?? null : null }));
  const created = await dbInsert<MtInvitation>("mt_invitations", rows);

  for (const c of created) {
    if (c.invitee_profile_id) {
      await notify(c.invitee_profile_id, "mt_invite", id, null, `הוזמנתם להגיש הצעה: ${t.title}`,
        "קיבלתם הזמנה אישית מהמזמין. ההצעה חתומה עד למועד האחרון.", `/mt/i/${c.token}`);
    }
  }
  if (t.status === "open") {
    const label = t.is_anonymous ? "עסק בפלטפורמת שווה מכרזים" : (actor.email || "עסק בפלטפורמה");
    waitUntil(sendInviteEmails(t, created, label).catch(() => undefined));
  }
  await logEvent(id, null, actor.userId, "buyer", "mt_invite_sent", { count: created.length, known: known.length });
  return ok({ invitations: created.map((c) => ({ id: c.id, email: c.invitee_email, phone: c.invitee_phone, link: `${SITE}/mt/i/${c.token}`, registered: !!c.invitee_profile_id })) }, 201);
});

export const DELETE = handle(async (req, ctx: Params<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await requireProfile(req);
  const t = await loadTender(id);
  assertBuyer(t, actor.profile.user_id);
  const invId = uuid(new URL(req.url).searchParams.get("id"), "מזהה הזמנה")!;
  await dbUpdate("mt_invitations", `?id=eq.${invId}&tender_id=eq.${id}`, { status: "revoked" });
  return ok({ ok: true });
});
