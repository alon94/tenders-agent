// /api/mt/open — מיני־מכרזים פתוחים למציע: סינון, ומיון «הכי מתאים לי» לפי הפרופיל
import { requireActor } from "@/app/lib/mt/auth";
import { dbSelect } from "@/app/lib/mt/db";
import { handle, ok } from "@/app/lib/mt/http";
import type { MtTender } from "@/app/lib/mt/types";

export const dynamic = "force-dynamic";
type Row = Pick<MtTender, "id" | "title" | "category_ids" | "region" | "city" | "is_remote" | "budget_min" | "budget_max" | "budget_visible" | "deadline_at" | "proposals_count" | "published_at" | "is_anonymous" | "buyer_profile_id" | "blocked_profile_ids" | "engagement_type">;

export const GET = handle(async (req) => {
  const actor = await requireActor(req);
  const url = new URL(req.url);
  const cat = url.searchParams.get("category");
  const region = url.searchParams.get("region");
  const remote = url.searchParams.get("remote") === "1";
  const budgetMin = Number(url.searchParams.get("budget_min") || 0);
  const sort = url.searchParams.get("sort") || "match";

  let q = `?status=eq.open&deleted_at=is.null&select=id,title,category_ids,region,city,is_remote,budget_min,budget_max,budget_visible,deadline_at,proposals_count,published_at,is_anonymous,buyer_profile_id,blocked_profile_ids,engagement_type&order=published_at.desc&limit=200`;
  if (cat) q += `&category_ids=cs.{${encodeURIComponent(cat)}}`;
  if (region && remote) q += `&or=(region.eq.${encodeURIComponent(region)},is_remote.eq.true)`;
  else if (region) q += `&region=eq.${encodeURIComponent(region)}`;
  else if (remote) q += `&is_remote=eq.true`;
  if (budgetMin > 0) q += `&budget_visible=eq.true&budget_max=gte.${budgetMin}`;

  const me = actor.profile?.user_id || null;
  let rows = await dbSelect<Row>("mt_tenders", q);
  rows = rows.filter((r) => r.buyer_profile_id !== me && !(me && r.blocked_profile_ids.includes(me)));

  const myCats = new Set(actor.profile?.categories || []);
  const myRegion = actor.profile?.region || null;
  const score = (r: Row) => (r.category_ids.some((c) => myCats.has(c)) ? 2 : 0) + (r.is_remote || (myRegion && r.region === myRegion) ? 1 : 0);
  if (sort === "match") rows.sort((a, b) => score(b) - score(a) || (b.published_at || "").localeCompare(a.published_at || ""));
  else if (sort === "deadline") rows.sort((a, b) => (a.deadline_at || "").localeCompare(b.deadline_at || ""));

  const twoDaysAgo = Date.now() - 48 * 3.6e6;
  return ok({
    tenders: rows.map((r) => ({
      id: r.id, title: r.title, category_ids: r.category_ids, region: r.region, city: r.city, is_remote: r.is_remote,
      budget_min: r.budget_visible ? r.budget_min : null, budget_max: r.budget_visible ? r.budget_max : null,
      deadline_at: r.deadline_at, proposals_count: r.proposals_count, published_at: r.published_at,
      engagement_type: r.engagement_type, is_anonymous: r.is_anonymous,
      is_new: !!r.published_at && new Date(r.published_at).getTime() > twoDaysAgo,
      match_score: score(r),
    })),
  });
});
