'use client';
// פרטי מיני־מכרז כפי שהמציע רואה אותם — משותף ל-/mt/[id] ול-/mt/i/[token]
import type { ReactNode } from 'react';
import { DOMAINS } from '../lib/domains';
import { CRITERIA_LABEL, ENGAGEMENT_LABEL, PAYMENT_LABEL, PRICING_LABEL, UNIT_LABEL, fmtBudget, fmtDate, fmtDateTime, openMtFile, regionLabel, timeLeft } from '../lib/mt/client';
import type { MtAttachment, MtItem, MtQuestion, MtRequirement, MtTender } from '../lib/mt/types';
import { Badge, C, Card, KV, StatusBadge } from './ui';

/** הצורה ש-shapeForViewer מחזיר (חלק מהשדות אינם קיימים במקור המלא, ולהפך) */
export type ViewerTender = Pick<MtTender,
  'id' | 'status' | 'title' | 'category_ids' | 'engagement_type' | 'description' | 'description_updates' | 'region' | 'city' | 'is_remote' |
  'budget_min' | 'budget_max' | 'budget_visible' | 'vat_included' | 'pricing_mode' | 'criteria_weights' | 'payment_terms' | 'is_anonymous' |
  'allow_split_award' | 'deadline_at' | 'questions_close_at' | 'desired_start_mode' | 'desired_start' | 'proposal_validity_days' | 'proposals_count' | 'published_at' | 'closed_at'> & {
  buyer?: { anonymous: boolean; profile_id?: string; categories: string[]; region: string | null; email?: string | null } | null;
};

const catLabel = (c: string) => DOMAINS.find((d) => d.id === c)?.label || c;

export function buyerLabel(t: ViewerTender, fallbackEmail?: string | null): string {
  const b = t.buyer;
  if (!b) return fallbackEmail || 'עסק בפלטפורמה';
  if (b.anonymous) return `עסק בתחום ${(b.categories || []).map(catLabel).join(', ') || '—'}${b.region ? ` מאזור ${regionLabel(b.region)}` : ''} (אנונימי)`;
  return b.email || fallbackEmail || 'עסק רשום בפלטפורמה';
}

export default function TenderDetails({ tender: t, items, requirements, files = [], questions = [], extra }: {
  tender: ViewerTender; items: MtItem[]; requirements: MtRequirement[]; files?: MtAttachment[]; questions?: MtQuestion[]; extra?: ReactNode;
}) {
  const clarifications = questions.filter((q) => q.is_published && q.answer_text);
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <StatusBadge status={t.status} />
          {t.status === 'open' && <Badge fg={C.amber} bg={C.amberPale}>{timeLeft(t.deadline_at)}</Badge>}
          <span style={{ fontSize: '0.78rem', color: C.muted }}>{t.proposals_count} הצעות הוגשו עד כה</span>
        </div>
        <KV k="מזמין" v={buyerLabel(t)} />
        <KV k="תחום" v={t.category_ids.map(catLabel).join(', ')} />
        <KV k="סוג התקשרות" v={t.engagement_type ? ENGAGEMENT_LABEL[t.engagement_type] : '—'} />
        <KV k="מיקום" v={t.is_remote ? 'מרחוק / לא רלוונטי' : [regionLabel(t.region), t.city].filter(Boolean).join(', ') || '—'} />
        <KV k="תקציב" v={t.budget_visible ? fmtBudget(t.budget_min, t.budget_max) : <span style={{ color: C.muted }}>לא פורסם</span>} />
        <KV k="תמחור" v={`${PRICING_LABEL[t.pricing_mode]} · מחירים ${t.vat_included ? 'כוללים' : 'לפני'} מע״מ`} />
        <KV k="תנאי תשלום" v={t.payment_terms ? PAYMENT_LABEL[t.payment_terms] : 'לא צוין'} />
        <KV k="מועד אחרון להגשה" v={<b>{fmtDateTime(t.deadline_at)}</b>} />
        <KV k="שאלות עד" v={fmtDateTime(t.questions_close_at)} />
        <KV k="תחילת עבודה" v={t.desired_start_mode === 'asap' ? 'מיד' : t.desired_start_mode === 'flexible' ? 'גמיש' : t.desired_start ? fmtDate(t.desired_start) : '—'} />
        <KV k="תוקף הצעה נדרש" v={`${t.proposal_validity_days} ימים`} />
        <KV k="קריטריוני בחירה" v={(Object.keys(CRITERIA_LABEL) as (keyof typeof CRITERIA_LABEL)[]).map((k) => `${CRITERIA_LABEL[k]} ${t.criteria_weights?.[k] ?? 0}%`).join(' · ')} />
      </Card>

      <Card title="תיאור">
        <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.65 }}>{t.description}</div>
        {(t.description_updates || []).map((u, i) => (
          <div key={i} style={{ marginTop: 10, padding: '8px 12px', background: C.amberPale, borderRadius: 8, fontSize: '0.82rem' }}>
            <b>עדכון {i + 1} ({fmtDateTime(u.at)}):</b> <span style={{ whiteSpace: 'pre-wrap' }}>{u.text}</span>
          </div>
        ))}
      </Card>

      <Card title="שורות דרישה">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead><tr style={{ color: C.muted, textAlign: 'right' }}><th style={{ padding: '6px 4px', fontWeight: 600 }}>#</th><th style={{ padding: '6px 4px', fontWeight: 600 }}>תיאור</th><th style={{ padding: '6px 4px', fontWeight: 600 }}>כמות</th><th style={{ padding: '6px 4px', fontWeight: 600 }}>יחידה</th></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: '7px 4px', color: C.muted }}>{i + 1}</td>
                <td style={{ padding: '7px 4px' }}>{it.description}{it.is_optional && <span style={{ color: C.muted }}> (אופציונלי)</span>}</td>
                <td style={{ padding: '7px 4px' }}>{Number(it.quantity).toLocaleString('he-IL')}</td>
                <td style={{ padding: '7px 4px' }}>{UNIT_LABEL[it.unit]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {requirements.length > 0 && (
        <Card title="דרישות סף">
          <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: '0.84rem', lineHeight: 1.7 }}>
            {requirements.map((r) => <li key={r.id}>{r.label} {r.is_mandatory ? <Badge fg={C.red} bg={C.redPale}>חובה</Badge> : <Badge>רצוי</Badge>}</li>)}
          </ul>
        </Card>
      )}

      {files.length > 0 && (
        <Card title="קבצים מצורפים">
          {files.map((f) => (
            <div key={f.id} style={{ fontSize: '0.84rem', padding: '4px 0' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); openMtFile(f.id); }}>{f.file_name}</a> <span style={{ color: C.muted }}>({Math.round(f.size_bytes / 1024)} KB)</span>
            </div>
          ))}
        </Card>
      )}

      {clarifications.length > 0 && (
        <Card title="שאלות והבהרות">
          {clarifications.map((q) => (
            <div key={q.id} style={{ padding: '8px 0', borderBottom: `1px dashed ${C.border}`, fontSize: '0.84rem', lineHeight: 1.6 }}>
              <div style={{ color: C.muted, fontSize: '0.74rem' }}>הבהרה {q.clarification_number ?? ''} · {fmtDateTime(q.answered_at)}{q.requires_proposal_update && <Badge fg={C.amber} bg={C.amberPale}>דורש עדכון הצעות</Badge>}</div>
              {q.question_text && <div><b>שאלה:</b> {q.question_text}</div>}
              <div style={{ whiteSpace: 'pre-wrap' }}><b>תשובה:</b> {q.answer_text}</div>
            </div>
          ))}
        </Card>
      )}
      {extra}
    </div>
  );
}
