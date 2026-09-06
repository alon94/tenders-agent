'use client';
// /mt/[id]/compare — פתיחת המעטפות: טבלת השוואה, כרטיס מציע, הבהרה פרטית, בחירת זוכה / סגירה ללא בחירה, דיווח תוצאה.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import InternalShell from '../../../components/InternalShell';
import { DOMAINS } from '../../../lib/domains';
import { CLOSED_REASON_LABEL, UNIT_LABEL, errMessage, fmtDate, fmtDateTime, fmtMoney, mtFetch, openMtFile, regionLabel } from '../../../lib/mt/client';
import { CLOSED_REASONS, OUTCOMES, type BusinessProfileRow, type MtAttachment, type MtAward, type MtClosedReason, type MtItem, type MtOutcome, type MtProposal, type MtProposalItem, type MtRequirement, type MtTender } from '../../../lib/mt/types';
import { Badge, Btn, C, Card, Field, Input, Modal, Notice, Row, Select, SignInPrompt, Spinner, Stat, StatusBadge, Textarea, Toggle, useSession } from '../../ui';

type Prop = MtProposal & {
  bidder: BusinessProfileRow | null; items: MtProposalItem[]; requirement_answers: { requirement_id: string; meets: boolean; note: string | null }[];
  files: MtAttachment[]; meets_all_mandatory: boolean | null; weighted_score: number | null; expired: boolean;
};
type Resp = { tender: MtTender; items: MtItem[]; requirements: MtRequirement[]; awards: MtAward[]; summary: { count: number; lowest: number | null; average: number | null; spread: number | null; meets_all: number }; proposals: Prop[] };
type Clar = { id: string; question: string; asked_at: string; answer: string | null; answered_at: string | null };
type SortKey = 'total' | 'score' | 'delivery' | 'rank';

const deliveryDays = (p: MtProposal) => p.delivery_value == null ? null : p.delivery_unit === 'weeks' ? p.delivery_value * 7 : p.delivery_value;
const deliveryLabel = (p: MtProposal) => p.delivery_date ? `עד ${fmtDate(p.delivery_date)}` : p.delivery_value ? `${p.delivery_value} ${p.delivery_unit === 'weeks' ? 'שבועות' : 'ימים'}` : '—';
const bidderName = (p: Prop, i: number) => p.bidder?.email || `מציע ${i + 1}`;

export default function ComparePage() {
  const { id } = useParams<{ id: string }>();
  const { session, ready } = useSession();
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<SortKey>('total');
  const [starred, setStarred] = useState<Set<string>>(() => { try { const s = typeof window !== 'undefined' ? localStorage.getItem(`mt-star-${id}`) : null; return new Set<string>(s ? JSON.parse(s) : []); } catch { return new Set<string>(); } });
  const [openCard, setOpenCard] = useState<Prop | null>(null);
  const [clars, setClars] = useState<Clar[]>([]);
  const [clarText, setClarText] = useState('');
  const [awardFor, setAwardFor] = useState<Prop | null>(null);
  const [awardMsg, setAwardMsg] = useState('');
  const [shareRank, setShareRank] = useState(true);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState<MtClosedReason>('no_decision');
  const [closeNote, setCloseNote] = useState('');

  const load = () => mtFetch<Resp>(`/${id}/compare`).then(setData);
  useEffect(() => {
    if (!ready || !session) return;
    load().catch((e) => { const m = errMessage(e); if (/חתומות/.test(m)) window.location.replace(`/mt/${id}/manage`); else setErr(m); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session, id]);

  const sorted = useMemo(() => {
    if (!data) return [];
    const arr = [...data.proposals];
    const num = (v: number | null | undefined) => (v == null ? Number.POSITIVE_INFINITY : Number(v));
    if (sort === 'total') arr.sort((a, b) => num(a.total) - num(b.total));
    if (sort === 'score') arr.sort((a, b) => (b.weighted_score ?? -1) - (a.weighted_score ?? -1));
    if (sort === 'delivery') arr.sort((a, b) => num(deliveryDays(a)) - num(deliveryDays(b)));
    if (sort === 'rank') arr.sort((a, b) => num(a.rank) - num(b.rank));
    return arr;
  }, [data, sort]);

  const lowestByItem = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of data?.proposals || []) for (const it of p.items) if (!it.is_declined && it.line_total != null) m.set(it.tender_item_id, Math.min(m.get(it.tender_item_id) ?? Infinity, Number(it.line_total)));
    return m;
  }, [data]);

  function toggleStar(pid: string) {
    const next = new Set(starred); if (next.has(pid)) next.delete(pid); else next.add(pid); setStarred(next);
    try { localStorage.setItem(`mt-star-${id}`, JSON.stringify([...next])); } catch { /* ignore */ }
  }
  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true); setErr(''); setFlash('');
    try { await fn(); await load(); if (ok) setFlash(ok); } catch (e) { setErr(errMessage(e)); } finally { setBusy(false); }
  }
  async function openProposal(p: Prop) {
    setOpenCard(p); setClars([]);
    try { const r = await mtFetch<{ clarifications: Clar[] }>(`/proposals/${p.id}/clarify`); setClars(r.clarifications); } catch { /* ignore */ }
  }
  function exportCsv() {
    if (!data) return;
    const head = ['שורה', ...data.proposals.map((p, i) => bidderName(p, i))];
    const rows = data.items.map((it) => [it.description, ...data.proposals.map((p) => { const x = p.items.find((pi) => pi.tender_item_id === it.id); return x?.is_declined ? 'לא מציע' : x?.line_total ?? ''; })]);
    rows.push(['סה״כ', ...data.proposals.map((p) => p.total ?? '')]);
    rows.push(['זמן אספקה', ...data.proposals.map(deliveryLabel)]);
    rows.push(['ניקוד משוקלל', ...data.proposals.map((p) => p.weighted_score ?? '')]);
    const csv = '﻿' + [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `mt-compare-${id}.csv`; a.click();
  }

  if (!ready) return <InternalShell title="השוואת הצעות"><Spinner /></InternalShell>;
  if (!session) return <InternalShell title="השוואת הצעות"><SignInPrompt next={`/mt/${id}/compare`} /></InternalShell>;
  if (!data) return <InternalShell title="השוואת הצעות">{err ? <div style={{ padding: 22 }}><Notice kind="error">{err}</Notice><Btn href={`/mt/${id}/manage`} kind="secondary">לדף הניהול</Btn></div> : <Spinner label="פותחים את המעטפות…" />}</InternalShell>;

  const t = data.tender;
  const evaluating = t.status === 'evaluating';
  const award = data.awards[0];
  const winner = award ? data.proposals.find((p) => p.id === award.proposal_id) : null;
  const cell = { padding: '8px 6px', borderBottom: `1px solid ${C.border}`, fontSize: '0.82rem', verticalAlign: 'top' as const };
  const th = { ...cell, background: '#f7f9fb', fontWeight: 700, position: 'sticky' as const, top: 0 };

  return (
    <InternalShell title={t.title} subtitle={evaluating ? `בבחירה · ${data.summary.count} הצעות נפתחו ב-${fmtDateTime(t.closed_at)}` : undefined}
      action={<Row><Btn kind="secondary" small onClick={exportCsv}>ייצוא CSV</Btn><Btn href={`/mt/${id}/manage`} kind="secondary" small>דף הניהול</Btn></Row>}>
      <div style={{ padding: 22 }}>
        {err && <Notice kind="error">{err}</Notice>}
        {flash && <Notice kind="success">{flash}</Notice>}
        {award && winner && (
          <Card style={{ marginBottom: 14, borderColor: C.green }} title="נבחר זוכה">
            <div style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              <b>{winner.bidder?.email}</b> · {fmtMoney(winner.total)} · נבחר ב-{fmtDateTime(award.awarded_at)}. פרטי הקשר נשלחו לשני הצדדים במייל.
            </div>
            <div style={{ marginTop: 10, fontSize: '0.83rem' }}>
              <b>ההתקשרות יצאה לפועל?</b>{' '}
              {award.outcome ? <Badge fg={C.green} bg={C.greenPale}>{{ engaged: 'כן', not_engaged: 'לא', in_progress: 'עדיין בתהליך' }[award.outcome]}</Badge> : (
                <Row style={{ display: 'inline-flex', marginInlineStart: 8 }}>
                  {OUTCOMES.map((o: MtOutcome) => <Btn key={o} small kind="secondary" disabled={busy} onClick={() => run(() => mtFetch(`/awards/${award.id}/outcome`, { method: 'POST', body: { outcome: o } }), 'תודה על העדכון')}>{{ engaged: 'כן', not_engaged: 'לא', in_progress: 'עדיין בתהליך' }[o]}</Btn>)}
                </Row>
              )}
            </div>
          </Card>
        )}
        {t.status === 'no_award' && <Notice>המיני־מכרז נסגר ללא בחירה{t.closed_reason ? ` (${CLOSED_REASON_LABEL[t.closed_reason]})` : ''}.</Notice>}

        <Row gap={10} style={{ marginBottom: 16 }}>
          <Stat value={data.summary.count} label="הצעות" />
          <Stat value={fmtMoney(data.summary.lowest)} label="הזולה ביותר" />
          <Stat value={fmtMoney(data.summary.average)} label="ממוצע" />
          <Stat value={fmtMoney(data.summary.spread)} label="פער זולה–יקרה" />
          <Stat value={`${data.summary.meets_all}/${data.summary.count}`} label="עומדות בכל דרישות הסף" />
          <Stat value={<StatusBadge status={t.status} />} label="סטטוס" />
        </Row>

        {data.proposals.length === 0 ? <Card><div style={{ color: C.muted }}>לא התקבלו הצעות.</div></Card> : (
          <>
            <Row style={{ marginBottom: 8, justifyContent: 'space-between' }}>
              <Row gap={6} style={{ fontSize: '0.8rem' }}>
                <span style={{ color: C.muted }}>מיון:</span>
                {([['total', 'מחיר'], ['score', 'ניקוד משוקלל'], ['delivery', 'זמן אספקה'], ['rank', 'דירוג']] as [SortKey, string][]).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setSort(k)} style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${sort === k ? C.blue : '#d6dde4'}`, background: sort === k ? '#e8f1fb' : '#fff', color: sort === k ? C.blueDark : C.dark, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: sort === k ? 700 : 500 }}>{l}</button>
                ))}
              </Row>
              <span style={{ fontSize: '0.74rem', color: C.muted }}>מחירים {t.vat_included ? 'כוללים' : 'לפני'} מע״מ · הזול ביותר בכל שורה מודגש · לחיצה על עמודה פותחת את ההצעה המלאה</span>
            </Row>
            <div style={{ overflowX: 'auto', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 640, width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'right', minWidth: 180 }}>שורה</th>
                    {sorted.map((p, i) => (
                      <th key={p.id} style={{ ...th, minWidth: 150, cursor: 'pointer', background: p.status === 'won' ? C.greenPale : '#f7f9fb' }} onClick={() => openProposal(p)}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ wordBreak: 'break-all' }}>{bidderName(p, i)}</span>
                          <button type="button" aria-label="סימון מועמד סופי" onClick={(e) => { e.stopPropagation(); toggleStar(p.id); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: starred.has(p.id) ? '#D97706' : '#c5ccd3', fontSize: '1rem' }}>★</button>
                        </div>
                        <div style={{ fontWeight: 400, fontSize: '0.72rem', color: C.muted }}>{p.bidder?.region ? regionLabel(p.bidder.region) : ''} {p.status === 'won' && <Badge fg={C.green} bg="#fff">זוכה</Badge>}{p.expired && <Badge fg={C.red} bg={C.redPale}>פג תוקף</Badge>}{p.last_updated_at && p.first_submitted_at && p.last_updated_at !== p.first_submitted_at && <Badge>עודכנה</Badge>}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => (
                    <tr key={it.id}>
                      <td style={cell}>{it.description}<div style={{ color: C.muted, fontSize: '0.72rem' }}>{Number(it.quantity)} {UNIT_LABEL[it.unit]}</div></td>
                      {sorted.map((p) => {
                        const x = p.items.find((pi) => pi.tender_item_id === it.id);
                        const low = x && !x.is_declined && x.line_total != null && Number(x.line_total) === lowestByItem.get(it.id);
                        return <td key={p.id} style={{ ...cell, background: low ? C.greenPale : undefined, fontWeight: low ? 700 : 400 }}>
                          {!x || x.is_declined ? <span style={{ color: C.muted }}>לא מציע</span> : <>{fmtMoney(x.line_total)}<div style={{ color: C.muted, fontSize: '0.7rem' }}>{fmtMoney(x.unit_price)} ליח׳</div></>}
                        </td>;
                      })}
                    </tr>
                  ))}
                  <tr style={{ background: '#f7f9fb' }}><td style={{ ...cell, fontWeight: 800 }}>סה״כ{sorted.some((p) => p.discount_type) && <div style={{ fontWeight: 400, fontSize: '0.7rem', color: C.muted }}>אחרי הנחה</div>}</td>
                    {sorted.map((p) => <td key={p.id} style={{ ...cell, fontWeight: 800, background: Number(p.total) === data.summary.lowest ? C.greenPale : undefined }}>{fmtMoney(p.total)}{p.discount_type && <div style={{ fontWeight: 400, fontSize: '0.7rem', color: C.muted }}>הנחה {p.discount_type === 'percent' ? `${p.discount_value}%` : fmtMoney(p.discount_value)}</div>}</td>)}</tr>
                  <tr><td style={cell}>זמן אספקה</td>{sorted.map((p) => <td key={p.id} style={cell}>{deliveryLabel(p)}</td>)}</tr>
                  <tr><td style={cell}>תוקף ההצעה</td>{sorted.map((p) => <td key={p.id} style={cell}>{p.validity_days} ימים · עד {fmtDate(p.valid_until)}</td>)}</tr>
                  {data.requirements.map((r) => (
                    <tr key={r.id}><td style={cell}>{r.label}{r.is_mandatory && <span style={{ color: C.red }}> *</span>}</td>
                      {sorted.map((p) => { const a = p.requirement_answers.find((x) => x.requirement_id === r.id); return <td key={p.id} style={cell}>{a ? (a.meets ? <span style={{ color: C.green, fontWeight: 700 }}>✓</span> : <span style={{ color: C.red, fontWeight: 700 }}>✗</span>) : '—'}{a?.note && <div style={{ color: C.muted, fontSize: '0.7rem' }}>{a.note}</div>}</td>; })}</tr>
                  ))}
                  <tr><td style={cell}>ניסיון מוצהר</td>{sorted.map((p) => <td key={p.id} style={cell}>{p.experience_text ? <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.experience_text}</span> : <span style={{ color: C.muted }}>—</span>}{p.experience_links?.length ? <div style={{ fontSize: '0.7rem' }}>{p.experience_links.length} קישורים</div> : null}</td>)}</tr>
                  <tr style={{ background: '#f7f9fb' }}><td style={{ ...cell, fontWeight: 800 }}>ניקוד משוקלל<div style={{ fontWeight: 400, fontSize: '0.7rem', color: C.muted }}>מחיר {t.criteria_weights.price}% · אספקה {t.criteria_weights.delivery}% · ניסיון {t.criteria_weights.experience}% · איכות {t.criteria_weights.quality}%</div></td>
                    {sorted.map((p) => { const best = Math.max(...data.proposals.map((x) => x.weighted_score ?? 0)); return <td key={p.id} style={{ ...cell, fontWeight: 800, background: p.weighted_score === best ? C.greenPale : undefined }}>{p.weighted_score ?? '—'}</td>; })}</tr>
                  {evaluating && (
                    <tr><td style={cell} />{sorted.map((p) => <td key={p.id} style={cell}>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <Btn small disabled={busy || p.status !== 'submitted'} onClick={() => { setAwardFor(p); setAwardMsg(''); setShareRank(true); }}>בחר כזוכה</Btn>
                        <Btn small kind="secondary" onClick={() => openProposal(p)}>הצעה מלאה</Btn>
                      </div>
                    </td>)}</tr>
                  )}
                </tbody>
              </table>
            </div>
            {evaluating && (
              <Row style={{ marginTop: 16, justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: C.muted }}>לא בחרתם? בעוד 30 יום מהסגירה המיני־מכרז ייסגר אוטומטית ללא בחירה.</span>
                <Btn kind="danger" small onClick={() => setCloseOpen(true)}>סגור ללא בחירה</Btn>
              </Row>
            )}
          </>
        )}
      </div>

      {openCard && (
        <Modal title={bidderName(openCard, data.proposals.indexOf(openCard))} onClose={() => setOpenCard(null)}>
          <div style={{ fontSize: '0.84rem', lineHeight: 1.6 }}>
            <Card style={{ marginBottom: 10, background: '#f7f9fb' }}>
              <div><b>פרופיל העסק:</b> {openCard.bidder?.email || '—'}</div>
              <div>תחומים: {(openCard.bidder?.categories || []).map((c) => DOMAINS.find((d) => d.id === c)?.label || c).join(', ') || '—'} · אזור: {regionLabel(openCard.bidder?.region) || '—'}</div>
              {openCard.bidder?.keywords && <div style={{ color: C.muted }}>{openCard.bidder.keywords}</div>}
            </Card>
            <div style={{ marginBottom: 6 }}><b>סה״כ:</b> {fmtMoney(openCard.total)} · <b>אספקה:</b> {deliveryLabel(openCard)} · <b>תוקף:</b> {openCard.validity_days} ימים · הוגשה {fmtDateTime(openCard.first_submitted_at)}{openCard.last_updated_at !== openCard.first_submitted_at && `, עודכנה ${fmtDateTime(openCard.last_updated_at)}`}</div>
            {openCard.experience_text && <div style={{ marginBottom: 6 }}><b>ניסיון:</b> <span style={{ whiteSpace: 'pre-wrap' }}>{openCard.experience_text}</span></div>}
            {openCard.experience_links?.length > 0 && <div style={{ marginBottom: 6 }}><b>קישורים:</b> {openCard.experience_links.map((l) => <a key={l} href={l} target="_blank" rel="noreferrer" style={{ marginInlineEnd: 8 }}>{l}</a>)}</div>}
            {openCard.notes && <div style={{ marginBottom: 6 }}><b>הערות והנחות:</b> <span style={{ whiteSpace: 'pre-wrap' }}>{openCard.notes}</span></div>}
            {openCard.files.length > 0 && <div style={{ marginBottom: 6 }}><b>קבצים:</b> {openCard.files.map((f) => <a key={f.id} href="#" onClick={(e) => { e.preventDefault(); openMtFile(f.id); }} style={{ marginInlineEnd: 8 }}>{f.file_name}</a>)}</div>}
            {data.requirements.length > 0 && <div style={{ marginBottom: 6 }}><b>דרישות סף:</b> {data.requirements.map((r) => { const a = openCard.requirement_answers.find((x) => x.requirement_id === r.id); return <div key={r.id}>{a?.meets ? '✓' : '✗'} {r.label}{a?.note ? ` — ${a.note}` : ''}</div>; })}</div>}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
              <b>הבהרות פרטיות</b> <span style={{ color: C.muted, fontSize: '0.74rem' }}>(שאלה למציע זה בלבד; לא ניתן לשנות מחיר)</span>
              {clars.map((c) => <div key={c.id} style={{ marginTop: 6, background: '#f7f9fb', borderRadius: 8, padding: 8 }}><div><b>ש:</b> {c.question} <span style={{ color: C.muted, fontSize: '0.7rem' }}>{fmtDateTime(c.asked_at)}</span></div>{c.answer ? <div><b>ת:</b> {c.answer}</div> : <div style={{ color: C.muted }}>ממתין לתשובה</div>}</div>)}
              {evaluating && (
                <Row style={{ marginTop: 8 }}>
                  <Input value={clarText} placeholder="בקשת הבהרה" maxLength={1500} onChange={(e) => setClarText(e.target.value)} style={{ width: 'auto', flex: 1 }} />
                  <Btn small disabled={busy || clarText.trim().length < 2} onClick={() => run(() => mtFetch(`/proposals/${openCard.id}/clarify`, { method: 'POST', body: { text: clarText } }).then(() => { setClarText(''); return openProposal(openCard); }), 'הבקשה נשלחה למציע')}>שליחה</Btn>
                </Row>
              )}
            </div>
          </div>
        </Modal>
      )}

      {awardFor && (
        <Modal title={`לבחור את ${bidderName(awardFor, data.proposals.indexOf(awardFor))} כזוכה?`} onClose={() => setAwardFor(null)}
          footer={<><Btn disabled={busy} onClick={() => run(() => mtFetch(`/proposals/${awardFor.id}/award`, { method: 'POST', body: { message: awardMsg || undefined, share_rank: shareRank } }).then(() => setAwardFor(null)), 'נבחר זוכה. פרטי הקשר נשלחו לשני הצדדים.')}>{busy ? 'שומר…' : 'אישור הבחירה'}</Btn><Btn kind="secondary" onClick={() => setAwardFor(null)}>ביטול</Btn></>}>
          <Notice>{fmtMoney(awardFor.total)} · {deliveryLabel(awardFor)}. הזוכה יקבל את פרטי הקשר שלכם{t.is_anonymous ? ' (גם אם המיני־מכרז היה אנונימי)' : ''}; שאר המציעים יקבלו הודעה מכובדת.</Notice>
          <Field label="הודעה אישית לזוכה (לא חובה)"><Textarea value={awardMsg} maxLength={1000} onChange={(e) => setAwardMsg(e.target.value)} style={{ minHeight: 70 }} /></Field>
          <Toggle checked={shareRank} onChange={setShareRank} label="לשלוח למציעים האחרים את הדירוג שלהם" hint="בלי מחירים. למשל: «הצעתכם דורגה 3 מתוך 5»" />
        </Modal>
      )}

      {closeOpen && (
        <Modal title="סגירה ללא בחירה" onClose={() => setCloseOpen(false)}
          footer={<><Btn kind="danger" disabled={busy} onClick={() => run(() => mtFetch(`/${id}/close`, { method: 'POST', body: { reason: closeReason, note: closeNote || undefined } }).then(() => setCloseOpen(false)), 'המיני־מכרז נסגר ללא בחירה')}>סגירה</Btn><Btn kind="secondary" onClick={() => setCloseOpen(false)}>חזרה</Btn></>}>
          <Field label="סיבה" required><Select value={closeReason} onChange={(e) => setCloseReason(e.target.value as MtClosedReason)}>{CLOSED_REASONS.map((r) => <option key={r} value={r}>{CLOSED_REASON_LABEL[r]}</option>)}</Select></Field>
          <Field label="הערה (לא חובה)"><Input value={closeNote} maxLength={500} onChange={(e) => setCloseNote(e.target.value)} /></Field>
          <div style={{ fontSize: '0.8rem', color: C.muted }}>המציעים יקבלו הודעה מכובדת. אפשר לשכפל את המיני־מכרז ולפרסם מחדש בהמשך.</div>
        </Modal>
      )}
    </InternalShell>
  );
}
