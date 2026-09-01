// ============================================================
//  test-mt-rls.ts — בדיקות RLS למיני־מכרז מול פרויקט Supabase אמיתי (staging)
//  אפיון: docs/אפיון-טכני-מיני-מכרז.docx סעיף 12.1
//
//  הרצה:  SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
//         npx tsx scripts/test-mt-rls.ts
//
//  מה קורה: נוצרים 3 משתמשי בדיקה זמניים (מזמין, מציע א', מציע ב'), מיני־מכרז
//  והצעות דרך service role, ואז כל בדיקה רצה דרך PostgREST *עם הטוקן של המשתמש*
//  — בדיוק כמו שהדפדפן היה עושה. בסוף הכול נמחק (גם אם בדיקה נכשלה).
//  הבדיקות עוקבות אחרי הכלל: ללקוח SELECT בלבד, ומזמין לא רואה הצעות לפני המועד.
// ============================================================

const URL_ = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!URL_ || !ANON || !SERVICE) {
  console.error("חסרים משתני סביבה: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
}

const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const asUser = (token: string) => ({ apikey: ANON, Authorization: `Bearer ${token}` });

async function rest(path: string, init: RequestInit & { headers: Record<string, string> }) {
  const res = await fetch(`${URL_}/rest/v1${path}`, { cache: "no-store", ...init });
  const text = await res.text();
  let body: any = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}
const svcInsert = (table: string, rows: unknown) =>
  rest(`/${table}`, { method: "POST", headers: { ...svc, Prefer: "return=representation" }, body: JSON.stringify(rows) });
const svcPatch = (table: string, filter: string, patch: unknown) =>
  rest(`/${table}?${filter}`, { method: "PATCH", headers: { ...svc, Prefer: "return=representation" }, body: JSON.stringify(patch) });
const svcDelete = (table: string, filter: string) => rest(`/${table}?${filter}`, { method: "DELETE", headers: svc });

// ---------- משתמשי בדיקה ----------
type TestUser = { id: string; email: string; token: string };
const stamp = Date.now();
const password = `Mt-test-${stamp}!`;

async function createUser(label: string): Promise<TestUser> {
  const email = `mt-rls-${label}-${stamp}@example.test`;
  const create = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: "POST", headers: svc,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!create.ok) throw new Error(`יצירת משתמש ${label} נכשלה: ${create.status} ${await create.text()}`);
  const { id } = await create.json();
  const login = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) throw new Error(`התחברות ${label} נכשלה: ${login.status} ${await login.text()}`);
  const { access_token } = await login.json();
  return { id, email, token: access_token };
}
async function deleteUser(id: string) {
  await fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
}

async function main() {
  console.log("\nמיני־מכרז — בדיקות RLS מול", URL_);
  const buyer = await createUser("buyer");
  const bidderA = await createUser("bidderA");
  const bidderB = await createUser("bidderB");
  let tenderId = "";
  try {
    // פרופילים (upsert לפי user_id — כמו profileApi.ts)
    const prof = await rest(`/business_profiles?on_conflict=user_id`, {
      method: "POST", headers: { ...svc, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([buyer, bidderA, bidderB].map((u) => ({
        user_id: u.id, email: u.email, categories: ["construction"], region: "north",
      }))),
    });
    if (prof.status >= 300) throw new Error(`upsert פרופילים נכשל: ${prof.status} ${JSON.stringify(prof.body)}`);

    // מיני־מכרז פתוח עם מועד עתידי (הצעות חתומות)
    const future = new Date(Date.now() + 5 * 86400000).toISOString();
    const qClose = new Date(Date.now() + 4 * 86400000).toISOString();
    const t = await svcInsert("mt_tenders", {
      buyer_profile_id: buyer.id, created_by_user_id: buyer.id, title: "בדיקת RLS",
      category_ids: ["construction"], deadline_at: future, questions_close_at: qClose,
    });
    if (t.status >= 300) throw new Error(`יצירת מיני־מכרז נכשלה: ${t.status} ${JSON.stringify(t.body)}`);
    tenderId = t.body[0].id;
    const pub = await svcPatch("mt_tenders", `id=eq.${tenderId}`, { status: "open" });
    if (pub.status >= 300) throw new Error(`פרסום נכשל: ${JSON.stringify(pub.body)}`);

    const item = await svcInsert("mt_tender_items", { tender_id: tenderId, position: 1, description: "צביעה", quantity: 4, unit: "unit" });
    await svcInsert("mt_questions", { tender_id: tenderId, asker_profile_id: bidderA.id, question_text: "שאלה", answer_text: "תשובה", is_published: true, answered_at: new Date().toISOString() });

    const p = await svcInsert("mt_proposals", [
      { tender_id: tenderId, bidder_profile_id: bidderA.id, submitted_by_user_id: bidderA.id, status: "submitted", sealed_until: future, subtotal: 10000, total: 10000 },
      { tender_id: tenderId, bidder_profile_id: bidderB.id, submitted_by_user_id: bidderB.id, status: "submitted", sealed_until: future, subtotal: 8000, total: 8000 },
    ]);
    if (p.status >= 300) throw new Error(`יצירת הצעות נכשלה: ${p.status} ${JSON.stringify(p.body)}`);

    console.log("\nלפני המועד");
    let r = await rest(`/mt_proposals?tender_id=eq.${tenderId}&select=id`, { headers: asUser(buyer.token) });
    check("1. מזמין לא מקבל אף הצעה לפני המועד", r.status === 200 && Array.isArray(r.body) && r.body.length === 0, `status ${r.status}, rows ${JSON.stringify(r.body)}`);

    r = await rest(`/mt_proposals?tender_id=eq.${tenderId}&select=id,bidder_profile_id`, { headers: asUser(bidderA.token) });
    check("2. מציע א' רואה רק את ההצעה שלו", r.status === 200 && r.body.length === 1 && r.body[0].bidder_profile_id === bidderA.id, JSON.stringify(r.body));

    r = await rest(`/mt_tenders?id=eq.${tenderId}&select=id,proposals_count`, { headers: asUser(bidderA.token) });
    check("   מציע רואה את המיני־מכרז הפתוח + מונה בלבד", r.status === 200 && r.body.length === 1 && r.body[0].proposals_count === 2, JSON.stringify(r.body));

    r = await rest(`/mt_tenders?id=eq.${tenderId}&select=id`, { headers: { apikey: ANON } });
    check("4. אורח (anon) לא מקבל כלום", r.status !== 200 || (Array.isArray(r.body) && r.body.length === 0), `status ${r.status}`);

    r = await rest(`/mt_proposals`, { method: "POST", headers: { ...asUser(bidderA.token), "Content-Type": "application/json" },
      body: JSON.stringify({ tender_id: tenderId, bidder_profile_id: bidderA.id, submitted_by_user_id: bidderA.id, sealed_until: future }) });
    check("5. מציע לא יכול לכתוב ישירות ל־PostgREST", r.status === 401 || r.status === 403, `status ${r.status}`);

    r = await rest(`/mt_events?tender_id=eq.${tenderId}`, { headers: asUser(buyer.token) });
    check("   יומן האירועים חסום ללקוח", r.status === 401 || r.status === 403 || r.status === 404, `status ${r.status}`);

    r = await rest(`/mt_questions_public?tender_id=eq.${tenderId}`, { headers: asUser(bidderB.token) });
    check("6. שאלות למציע — דרך ה־view, בלי זהות השואל", r.status === 200 && r.body.length === 1 && !("asker_profile_id" in r.body[0]), JSON.stringify(r.body));
    r = await rest(`/mt_questions?tender_id=eq.${tenderId}&select=asker_profile_id`, { headers: asUser(buyer.token) });
    check("   המזמין כן רואה את זהות השואל", r.status === 200 && r.body[0]?.asker_profile_id === bidderA.id, JSON.stringify(r.body));

    // חסימה
    await svcPatch("mt_tenders", `id=eq.${tenderId}`, { blocked_profile_ids: [bidderB.id] });
    r = await rest(`/mt_tenders?id=eq.${tenderId}&select=id`, { headers: asUser(bidderB.token) });
    check("3. מציע חסום לא רואה את המיני־מכרז", r.status === 200 && r.body.length === 0, JSON.stringify(r.body));
    await svcPatch("mt_tenders", `id=eq.${tenderId}`, { blocked_profile_ids: [] });

    console.log("\nאחרי המועד (הזזת sealed_until ו־deadline לעבר + mt_tick)");
    const past = new Date(Date.now() - 60000).toISOString();
    const pastQ = new Date(Date.now() - 2 * 86400000).toISOString();
    await svcPatch("mt_tenders", `id=eq.${tenderId}`, { deadline_at: past, questions_close_at: pastQ });
    await svcPatch("mt_proposals", `tender_id=eq.${tenderId}`, { sealed_until: past });
    const tick = await fetch(`${URL_}/rest/v1/rpc/mt_tick`, { method: "POST", headers: svc, body: "{}" });
    check("   mt_tick רץ", tick.ok, `${tick.status} ${await tick.text()}`);

    r = await rest(`/mt_tenders?id=eq.${tenderId}&select=status`, { headers: asUser(buyer.token) });
    check("   הסטטוס עבר ל־evaluating", r.body?.[0]?.status === "evaluating", JSON.stringify(r.body));
    r = await rest(`/mt_proposals?tender_id=eq.${tenderId}&select=id,rank,total&order=rank`, { headers: asUser(buyer.token) });
    check("   המזמין רואה את שתי ההצעות, מדורגות", r.status === 200 && r.body.length === 2 && r.body[0].rank === 1 && Number(r.body[0].total) === 8000, JSON.stringify(r.body));
    r = await rest(`/mt_proposals?tender_id=eq.${tenderId}&select=id`, { headers: asUser(bidderA.token) });
    check("   מציע א' עדיין רואה רק את שלו", r.status === 200 && r.body.length === 1, JSON.stringify(r.body));
    r = await rest(`/mt_notifications?select=id,channel`, { headers: asUser(buyer.token) });
    check("   המזמין רואה התראות in_app בלבד", r.status === 200 && r.body.length >= 1 && r.body.every((n: any) => n.channel === "in_app"), JSON.stringify(r.body));
    void item;
  } finally {
    console.log("\nניקוי…");
    if (tenderId) await svcDelete("mt_tenders", `id=eq.${tenderId}`);
    await svcDelete("mt_notifications", `user_id=in.(${[buyer.id, bidderA.id, bidderB.id].join(",")})`);
    await svcDelete("business_profiles", `user_id=in.(${[buyer.id, bidderA.id, bidderB.id].join(",")})`);
    await Promise.all([buyer, bidderA, bidderB].map((u) => deleteUser(u.id)));
  }
  console.log(failures ? `\n${failures} בדיקות נכשלו` : "\nכל בדיקות ה־RLS עברו");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
