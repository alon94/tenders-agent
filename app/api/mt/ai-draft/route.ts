// /api/mt/ai-draft — עוזר ניסוח: 2–3 משפטים → תיאור מובנה + שורות דרישה מוצעות (Claude, JSON בלבד)
import { requireCompleteProfile } from "@/app/lib/mt/auth";
import { logEvent } from "@/app/lib/mt/events";
import { handle, ok, readJson } from "@/app/lib/mt/http";
import { checkRate } from "@/app/lib/mt/rate";
import { UNITS, type MtUnit } from "@/app/lib/mt/types";
import { str, uuid, type Raw } from "@/app/lib/mt/validate";
import { DOMAINS } from "@/app/lib/domains";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const actor = await requireCompleteProfile(req);
  const b = await readJson<Raw>(req);
  const brief = str(b.brief, "תיאור קצר", { min: 15, max: 1500 })!;
  const tenderId = uuid(b.tender_id, "מיני־מכרז", { optional: true });
  await checkRate(`ai:${actor.profile.user_id}`, 10, 86400);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return ok({ available: false });

  const cats = DOMAINS.map((d) => `${d.id}=${d.label}`).join(", ");
  const prompt = `אתה עוזר לעסק קטן בישראל לנסח "מיני־מכרז" — בקשה להצעות מחיר מספקים. על בסיס התיאור החופשי של העסק, כתוב:
1. description: תיאור מובנה בעברית (150–600 מילים) עם הכותרות: רקע, מה נדרש, מה לא כלול, תוצר צפוי. בלי מחירים.
2. title: כותרת עד 80 תווים.
3. items: 2–8 שורות דרישה שספק יוכל לתמחר בנפרד: {description, quantity, unit} כאשר unit אחד מ: ${UNITS.join(", ")}.
4. category_id: אחד מ: ${cats}.
החזר JSON בלבד, ללא טקסט נוסף.

התיאור של העסק:
${brief}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1200, temperature: 0.3, messages: [{ role: "user", content: prompt }] }),
  }).catch(() => null);
  if (!res || !res.ok) return ok({ available: false });
  const data = (await res.json()) as { content?: { text?: string }[] };
  const text = data.content?.[0]?.text || "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return ok({ available: false });
  let parsed: { title?: string; description?: string; items?: { description?: string; quantity?: number; unit?: string }[]; category_id?: string };
  try { parsed = JSON.parse(m[0]); } catch { return ok({ available: false }); }

  const validCats = new Set(DOMAINS.map((d) => d.id));
  const items = (parsed.items || []).slice(0, 8).map((i, idx) => ({
    position: idx + 1,
    description: String(i.description || "").slice(0, 200),
    quantity: Number.isFinite(Number(i.quantity)) && Number(i.quantity) > 0 ? Number(i.quantity) : 1,
    unit: (UNITS as readonly string[]).includes(String(i.unit)) ? (i.unit as MtUnit) : "lump_sum",
  })).filter((i) => i.description.length > 1);
  if (tenderId) await logEvent(tenderId, null, actor.userId, "buyer", "mt_ai_draft_used", { items: items.length });
  return ok({
    available: true,
    title: String(parsed.title || "").slice(0, 90),
    description: String(parsed.description || "").slice(0, 3000),
    items,
    category_id: validCats.has(String(parsed.category_id)) ? parsed.category_id : null,
  });
});
