// ============================================================
// מיני־מכרז — טיפוסים וקבועים משותפים (שרת ולקוח).
// משקף את scripts/migrations/2026-09-mt.sql.
// ============================================================

export type MtTenderStatus =
  | "draft" | "open" | "evaluating" | "awarded" | "no_award" | "cancelled" | "expired" | "completed" | "archived";
export type MtEngagementType = "one_time" | "project" | "retainer" | "goods";
export type MtPricingMode = "fixed" | "hourly" | "per_unit" | "bidder_choice";
export type MtUnit = "unit" | "hour" | "sqm" | "month" | "lump_sum" | "other";
export type MtPaymentTerms = "net30" | "net60" | "advance_final" | "milestones" | "other";
export type MtReqKind = "licensed_dealer" | "insurance" | "professional_license" | "years_experience" | "references" | "custom";
export type MtProposalStatus = "draft" | "submitted" | "withdrawn" | "won" | "lost" | "expired";
export type MtClosedReason = "found_elsewhere" | "need_cancelled" | "mistake" | "no_decision" | "other";
export type MtOutcome = "engaged" | "not_engaged" | "in_progress";

export const ENGAGEMENT_TYPES: MtEngagementType[] = ["one_time", "project", "retainer", "goods"];
export const PRICING_MODES: MtPricingMode[] = ["fixed", "hourly", "per_unit", "bidder_choice"];
export const UNITS: MtUnit[] = ["unit", "hour", "sqm", "month", "lump_sum", "other"];
export const PAYMENT_TERMS: MtPaymentTerms[] = ["net30", "net60", "advance_final", "milestones", "other"];
export const REQ_KINDS: MtReqKind[] = ["licensed_dealer", "insurance", "professional_license", "years_experience", "references", "custom"];
export const CLOSED_REASONS: MtClosedReason[] = ["found_elsewhere", "need_cancelled", "mistake", "no_decision", "other"];
export const OUTCOMES: MtOutcome[] = ["engaged", "not_engaged", "in_progress"];

// מגבלות המוצר (אפיון מוצרי סעיפים 3–4)
export const LIMITS = {
  maxActiveTenders: 3,
  minDeadlineHours: 48,
  maxDeadlineDays: 30,
  questionsCloseBeforeHours: 24,
  maxItems: 30,
  maxTenderFiles: 10,
  maxProposalFiles: 5,
  maxFileBytes: 15 * 1024 * 1024,
  maxInvitations: 30,
  extendAllowedBelowProposals: 2,
  titleMax: 90,
  descriptionMin: 100,
  descriptionMax: 3000,
} as const;

export const ALLOWED_MIME = new Set([
  "application/pdf", "image/png", "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export interface MtTender {
  id: string;
  buyer_profile_id: string;
  created_by_user_id: string;
  status: MtTenderStatus;
  title: string;
  category_ids: string[];
  engagement_type: MtEngagementType | null;
  description: string | null;
  description_updates: { at: string; text: string }[];
  region: string | null;
  city: string | null;
  is_remote: boolean;
  budget_min: number | null;
  budget_max: number | null;
  budget_visible: boolean;
  vat_included: boolean;
  pricing_mode: MtPricingMode;
  criteria_weights: { price: number; delivery: number; experience: number; quality: number };
  payment_terms: MtPaymentTerms | null;
  is_anonymous: boolean;
  allow_split_award: boolean;
  deadline_at: string | null;
  questions_close_at: string | null;
  desired_start_mode: "asap" | "date" | "flexible" | null;
  desired_start: string | null;
  proposal_validity_days: number;
  public_link_enabled: boolean;
  public_token: string;
  blocked_profile_ids: string[];
  source_public_tender_id: string | null;
  extended_once_at: string | null;
  closed_reason: MtClosedReason | null;
  closed_note: string | null;
  proposals_count: number;
  views_count: number;
  published_at: string | null;
  closed_at: string | null;
  awarded_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MtItem {
  id: string; tender_id: string; position: number; description: string;
  quantity: number; unit: MtUnit; is_optional: boolean;
}
export interface MtRequirement {
  id: string; tender_id: string; kind: MtReqKind; label: string; value: unknown; is_mandatory: boolean;
}
export interface MtQuestion {
  id: string; tender_id: string; asker_profile_id: string | null; question_text: string | null;
  answer_text: string | null; answered_at: string | null; is_published: boolean;
  requires_proposal_update: boolean; clarification_number: number | null; created_at: string;
}
export interface MtInvitation {
  id: string; tender_id: string; kind: "direct" | "public_link"; token: string;
  invitee_name: string | null; invitee_email: string | null; invitee_phone: string | null;
  invitee_profile_id: string | null; status: string; sent_at: string; opened_at: string | null; registered_at: string | null;
}
export interface MtProposal {
  id: string; tender_id: string; bidder_profile_id: string; submitted_by_user_id: string;
  invitation_id: string | null; status: MtProposalStatus; sealed_until: string;
  subtotal: number | null; discount_type: "percent" | "amount" | null; discount_value: number; total: number | null;
  vat_included: boolean; delivery_value: number | null; delivery_unit: "days" | "weeks" | null; delivery_date: string | null;
  validity_days: number; valid_until: string | null; experience_text: string | null; experience_links: string[];
  notes: string | null; declaration_accepted_at: string | null; weighted_score: number | null; rank: number | null;
  buyer_private_note: string | null; buyer_starred: boolean;
  first_submitted_at: string | null; last_updated_at: string | null; withdrawn_at: string | null; created_at: string;
}
export interface MtProposalItem {
  id: string; proposal_id: string; tender_item_id: string; unit_price: number | null;
  quantity: number; line_total: number | null; is_declined: boolean;
}
export interface MtAward {
  id: string; tender_id: string; proposal_id: string; tender_item_id: string | null;
  message_to_winner: string | null; share_rank_with_others: boolean; awarded_at: string;
  awarded_by_user_id: string; outcome: MtOutcome | null; outcome_reported_at: string | null;
}
export interface MtAttachment {
  id: string; owner_type: "tender" | "proposal" | "question"; owner_id: string; storage_path: string;
  file_name: string; mime: string; size_bytes: number; uploaded_by_user_id: string; scanned_ok: boolean | null; created_at: string;
}

export interface BusinessProfileRow {
  user_id: string;
  email: string | null;
  categories: string[] | null;
  category_other: string | null;
  region: string | null;
  publisher_type: string | null;
  keywords: string | null;
  mt_notify_mode?: "instant" | "digest" | "off";
}

// פרופיל "מלא" לצורך פרסום מיני־מכרז. (TODO 1c: להוסיף business_name / phone / tax_id
// ל-business_profiles ולהחמיר כאן — כרגע הטבלה אינה מכילה אותם.)
export function profileIsComplete(p: BusinessProfileRow | null): boolean {
  return !!p && Array.isArray(p.categories) && p.categories.length > 0 && !!p.region;
}
