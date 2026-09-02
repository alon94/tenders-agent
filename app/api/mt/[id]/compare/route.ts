// /api/mt/[id]/compare — טבלת ההשוואה למזמין. רק אחרי המועד (בדיקה כפולה: כאן וב-RLS).
import { requireProfile } from "@/app/lib/mt/auth";
import { dbSelect } from "@/app/lib/mt/db";
import { logEvent } from "@/app/lib/mt/events";
import { conflict, handle, ok, type Params } from "@/app/lib/mt/http";
import { assertBuyer, loadAttachments, loadItems, loadRequirements, loadTender, scoreProposals } from "@/app/lib/mt/tender";
import type { BusinessProfileRow, MtAward, MtProposal, MtProposalItem } from "@/app/lib/mt/types";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, ctx: Params<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await requireProfile(req);
  const t = await loadTender(id);
  assertBuyer(t, actor.profile.user_id);
  if (!t.deadline_at || new Date(t.deadline_at).getTime() > Date.now() || t.status === "open" || t.status === "draft") {
    throw conflict("ההצעות חתומות עד המועד האחרון", "sealed");
  }
  const [items, reqs, proposals, awards] = await Promise.all([
    loadItems(id), loadRequirements(id),
    dbSelect<MtProposal>("mt_proposals", `?tender_id=eq.${id}&status=in.(submitted,won,lost,expired)&order=total.asc.nullslast&select=*`),
    dbSelect<MtAward>("mt_awards", `?tender_id=eq.${id}&select=*`),
  ]);
  const pids = proposals.map((p) => p.id);
  const [pItems, answers, bidders, filesByProposal] = pids.length ? await Promise.all([
    dbSelect<MtProposalItem>("mt_proposal_items", `?proposal_id=in.(${pids.join(",")})&select=*`),
    dbSelect<{ proposal_id: string; requirement_id: string; meets: boolean; note: string | null }>("mt_proposal_req_answers", `?proposal_id=in.(${pids.join(",")})&select=*`),
    dbSelect<BusinessProfileRow>("business_profiles", `?user_id=in.(${[...new Set(proposals.map((p) => p.bidder_profile_id))].join(",")})&select=user_id,email,categories,region,keywords`),
    Promise.all(pids.map((pid) => loadAttachments("proposal", pid).then((f) => [pid, f] as const))),
  ]) : [[], [], [], []];

  const mandatory = reqs.filter((r) => r.is_mandatory).map((r) => r.id);
  const meetsAll = new Map<string, boolean>();
  for (const p of proposals) {
    if (!mandatory.length) continue;
    const mine = answers.filter((a) => a.proposal_id === p.id);
    meetsAll.set(p.id, mandatory.every((rid) => mine.find((a) => a.requirement_id === rid)?.meets === true));
  }
  const scores = scoreProposals(t, proposals, meetsAll);
  const bidderOf = new Map(bidders.map((b) => [b.user_id, b]));
  const files = new Map(filesByProposal);

  const totals = proposals.map((p) => Number(p.total || 0)).filter((x) => x > 0);
  const summary = {
    count: proposals.length,
    lowest: totals.length ? Math.min(...totals) : null,
    average: totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : null,
    spread: totals.length ? Math.max(...totals) - Math.min(...totals) : null,
    meets_all: [...meetsAll.values()].filter(Boolean).length,
  };
  await logEvent(id, null, actor.userId, "buyer", "mt_comparison_viewed", { count: proposals.length });
  return ok({
    tender: t, items, requirements: reqs, awards, summary,
    proposals: proposals.map((p) => ({
      ...p,
      bidder: bidderOf.get(p.bidder_profile_id) || null,
      items: pItems.filter((i) => i.proposal_id === p.id),
      requirement_answers: answers.filter((a) => a.proposal_id === p.id),
      files: files.get(p.id) || [],
      meets_all_mandatory: meetsAll.get(p.id) ?? null,
      weighted_score: scores.get(p.id) ?? null,
      expired: p.valid_until ? new Date(p.valid_until).getTime() < Date.now() : false,
    })),
  });
});
