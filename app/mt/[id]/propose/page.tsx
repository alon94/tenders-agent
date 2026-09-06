'use client';
// /mt/[id]/propose — טופס הצעה (יצירה/עדכון). PUT /api/mt/[id]/proposal
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import InternalShell from '../../../components/InternalShell';
import { UNIT_LABEL, errMessage, fmtDateTime, fmtMoney, mtFetch, openMtFile, timeLeft, uploadMtFile } from '../../../lib/mt/client';
import { LIMITS, type MtAttachment, type MtItem, type MtProposal, type MtProposalItem, type MtRequirement } from '../../../lib/mt/types';
import type { ViewerTender } from '../../TenderDetails';
import { Btn, C, Card, Field, Input, Notice, Radio, Row, Select, SignInPrompt, Spinner, Textarea, useNow, useSession } from '../../ui';

type TenderResp = { role: 'buyer' | 'bidder'; tender: ViewerTender; items: MtItem[]; requirements: MtRequirement[] };
type MineResp = { proposal: MtProposal | null; items?: MtProposalItem[]; requirement_answers?: { requirement_id: string; meets: boolean; note: string | null }[]; files?: MtAttachment[] };
type Line = { tender_item_id: string; unit_price: string; is_declined: boolean };

function ProposeInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const inviteToken = params.get('invite') || undefined;
  const { session, ready } = useSession();
  const now = useNow();
  const [t, setT] = useState<TenderResp | null>(null);
  const [existing, setExisting] = useState<MtProposal | null>(null);
  const [files, setFiles] = useState<MtAttachment[]>([]);
  const [err, setErr] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [discountType, setDiscountType] = useState<'' | 'percent' | 'amount'>('');
  const [discountValue, setDiscountValue] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'duration' | 'date'>('duration');
  const [deliveryValue, setDeliveryValue] = useState('');
  const [deliveryUnit, setDeliveryUnit] = useState<'days' | 'weeks'>('days');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [validity, setValidity] = useState('');
  const [answers, setAnswers] = useState<Record<string, { meets: boolean | null; note: string }>>({});
  const [experience, setExperience] = useState('');
  const [links, setLinks] = useState(['', '', '']);
  const [notes, setNotes] = useState('');
  const [declaration, setDeclaration] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState<{ total: number; revision_no: number; id: string } | null>(null);

  useEffect(() => {
    if (!ready || !session) return;
    Promise.all([mtFetch<TenderResp>(`/${id}`), mtFetch<MineResp>(`/${id}/proposal`)]).then(([tr, mine]) => {
      if (tr.role === 'buyer') { window.location.replace(`/mt/${id}`); return; }
      setT(tr);
      setValidity(String(tr.tender.proposal_validity_days));
      const byItem = new Map((mine.items || []).map((i) => [i.tender_item_id, i]));
      setLines(tr.items.map((it) => {
        const m = byItem.get(it.id);
        return { tender_item_id: it.id, unit_price: m?.unit_price != null ? String(m.unit_price) : '', is_declined: m?.is_declined ?? false };
      }));
      const ans: Record<string, { meets: boolean | null; note: string }> = {};
      for (const r of tr.requirements) {
        const a = (mine.requirement_answers || []).find((x) => x.requirement_id === r.id);
        ans[r.id] = { meets: a ? a.meets : null, note: a?.note || '' };
      }
      setAnswers(ans);
      if (mine.proposal) {
        const p = mine.proposal;
        setExisting(p); setFiles(mine.files || []);
        setDiscountType(p.discount_type || ''); setDiscountValue(p.discount_value ? String(p.discount_value) : '');
        if (p.delivery_date) { setDeliveryMode('date'); setDeliveryDate(p.delivery_date); }
        else if (p.delivery_value) { setDeliveryValue(String(p.delivery_value)); setDeliveryUnit(p.delivery_unit || 'days'); }
        setValidity(String(p.validity_days)); setExperience(p.experience_text || '');
        setLinks([0, 1, 2].map((i) => p.experience_links?.[i] || '')); setNotes(p.notes || '');
      }
    }).catch((e) => setErr(errMessage(e)));
  }, [ready, session, id]);

  const subtotal = useMemo(() => {
    if (!t) return 0;
    return lines.reduce((s, l) => {
      if (l.is_declined) return s;
      const it = t.items.find((i) => i.id === l.tender_item_id);
      const price = Number(l.unit_price);
      return s + (it && isFinite(price) ? price * Number(it.quantity) : 0);
    }, 0);
  }, [lines, t]);
  const total = useMemo(() => {
    const d = Number(discountValue) || 0;
    if (discountType === 'percent') return Math.round(subtotal * (1 - d / 100) * 100) / 100;
    if (discountType === 'amount') return Math.max(0, subtotal - d);
    return subtotal;
  }, [subtotal, discountType, discountValue]);

  async function submit() {
    if (!t) return;
    setBusy(true); setErr('');
    try {
      const body = {
        items: lines.map((l) => ({ tender_item_id: l.tender_item_id, unit_price: l.is_declined ? null : Number(l.unit_price), is_declined: l.is_declined })),
        discount_type: discountType || undefined, discount_value: discountType ? Number(discountValue) || 0 : undefined,
        delivery_value: deliveryMode === 'duration' ? Number(deliveryValue) : undefined,
        delivery_unit: deliveryMode === 'duration' ? deliveryUnit : undefined,
        delivery_date: deliveryMode === 'date' && deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
        validity_days: Number(validity) || t.tender.proposal_validity_days,
        requirement_answers: t.requirements.map((r) => ({ requirement_id: r.id, meets: answers[r.id]?.meets === true, note: answers[r.id]?.note || undefined })),
        experience_text: experience || undefined, experience_links: links.filter(Boolean), notes: notes || undefined,
        declaration, invite_token: inviteToken,
      };
      for (const r of t.requirements) if (answers[r.id]?.meets == null) throw new Error(`יש לענות על דרישת הסף: ${r.label}`);
      const r = await mtFetch<{ id: string; revision_no: number; total: number }>(`/${id}/proposal`, { method: 'PUT', body });
      setDone(r);
      if (!existing) { const mine = await mtFetch<MineResp>(`/${id}/proposal`); setExisting(mine.proposal); setFiles(mine.files || []); }
      window.scrollTo({ top: 0 });
    } catch (e) { setErr(errMessage(e)); window.scrollTo({ top: 0 }); } finally { setBusy(false); }
  }
  async function onFiles(list: FileList | null) {
    if (!list?.length || !existing) return;
    setUploading(true);
    try {
      for (const f of Array.from(list)) await uploadMtFile('proposal', existing.id, f);
      const mine = await mtFetch<MineResp>(`/${id}/proposal`); setFiles(mine.files || []);
    } catch (e) { setErr(errMessage(e)); } finally { setUploading(false); }
  }

  if (!ready) return <InternalShell title="הגשת הצעה"><Spinner /></InternalShell>;
  if (!session) return <InternalShell title="הגשת הצעה"><SignInPrompt next={`/mt/${id}/propose${inviteToken ? `?invite=${inviteToken}` : ''}`} /></InternalShell>;
  if (!t) return <InternalShell title="הגשת הצעה">{err ? <div style={{ padding: 22 }}><Notice kind="error">{err}</Notice></div> : <Spinner />}</InternalShell>;

  const tender = t.tender;
  const isOpen = tender.status === 'open' && !!tender.deadline_at && new Date(tender.deadline_at).getTime() > now;

  if (done) {
    return (
      <InternalShell title="ההצעה נקלטה" subtitle={tender.title}>
        <div style={{ padding: 22, maxWidth: 720 }}>
          <Card>
            <Notice kind="success">
              ההצעה שלכם ({fmtMoney(done.total)}, {tender.vat_included ? 'כולל' : 'לפני'} מע״מ) נשמרה — גרסה {done.revision_no}.
              היא חתומה עד <b>{fmtDateTime(tender.deadline_at)}</b>: המזמין יראה אותה רק אז, יחד עם שאר ההצעות.
            </Notice>
            <Field label="קבצים להצעה (לא חובה)" hint={`עד ${LIMITS.maxProposalFiles} קבצים, 15MB: הצעה מפורטת, המלצות, תעודות`}>
              <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" disabled={uploading || files.length >= LIMITS.maxProposalFiles} onChange={(e) => onFiles(e.target.files)} />
              {uploading && <div style={{ fontSize: '0.75rem', color: C.muted }}>מעלה…</div>}
              {files.map((f) => <div key={f.id} style={{ fontSize: '0.8rem', padding: '3px 0' }}><a href="#" onClick={(e) => { e.preventDefault(); openMtFile(f.id); }}>{f.file_name}</a></div>)}
            </Field>
            <Row>
              <Btn href={`/mt/${id}`}>לדף המיני־מכרז</Btn>
              <Btn href="/mt" kind="secondary">ההצעות שלי</Btn>
            </Row>
          </Card>
        </div>
      </InternalShell>
    );
  }

  return (
    <InternalShell title={existing ? 'עריכת ההצעה' : 'הגשת הצעה'} subtitle={`${tender.title} · ${timeLeft(tender.deadline_at)}`} action={<Btn href={`/mt/${id}`} kind="ghost" small>חזרה לפרטי המיני־מכרז</Btn>}>
      <div style={{ padding: 22, display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 560px', minWidth: 0, maxWidth: 760 }}>
          {err && <Notice kind="error">{err}</Notice>}
          {!isOpen && <Notice kind="warn">המיני־מכרז אינו פתוח להגשות.</Notice>}
          {existing && <Notice>אתם עורכים הצעה קיימת (גרסה קודמת נשמרת; המזמין רואה רק את האחרונה, מסומנת «עודכנה»).</Notice>}

          <Card title="תמחור לפי שורות" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.76rem', color: C.muted, marginBottom: 8 }}>מחירים {tender.vat_included ? 'כוללים' : 'לפני'} מע״מ, לפי הגדרת המזמין.</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead><tr style={{ color: C.muted, textAlign: 'right' }}><th style={{ padding: 4, fontWeight: 600 }}>שורה</th><th style={{ padding: 4, fontWeight: 600 }}>כמות</th><th style={{ padding: 4, fontWeight: 600 }}>מחיר ליחידה (₪)</th><th style={{ padding: 4, fontWeight: 600 }}>סה״כ</th></tr></thead>
              <tbody>
                {t.items.map((it) => {
                  const l = lines.find((x) => x.tender_item_id === it.id)!;
                  const lineTotal = l.is_declined ? 0 : (Number(l.unit_price) || 0) * Number(it.quantity);
                  return (
                    <tr key={it.id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: '7px 4px' }}>{it.description}{it.is_optional && <div><label style={{ fontSize: '0.72rem', color: C.muted }}><input type="checkbox" checked={l.is_declined} onChange={(e) => setLines(lines.map((x) => x.tender_item_id === it.id ? { ...x, is_declined: e.target.checked } : x))} /> לא מציע שורה זו</label></div>}</td>
                      <td style={{ padding: '7px 4px', whiteSpace: 'nowrap' }}>{Number(it.quantity).toLocaleString('he-IL')} {UNIT_LABEL[it.unit]}</td>
                      <td style={{ padding: '7px 4px' }}><Input type="number" min={0} step="any" value={l.unit_price} disabled={l.is_declined} style={{ width: 130 }} onChange={(e) => setLines(lines.map((x) => x.tender_item_id === it.id ? { ...x, unit_price: e.target.value } : x))} /></td>
                      <td style={{ padding: '7px 4px', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtMoney(lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
              <Row>
                <span style={{ fontSize: '0.83rem', fontWeight: 700 }}>הנחה כללית:</span>
                <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as typeof discountType)} style={{ width: 130 }}>
                  <option value="">ללא</option><option value="percent">באחוזים</option><option value="amount">בש״ח</option>
                </Select>
                {discountType && <Input type="number" min={0} value={discountValue} style={{ width: 110 }} onChange={(e) => setDiscountValue(e.target.value)} />}
              </Row>
              <div style={{ textAlign: 'left', fontSize: '0.84rem' }}>
                <div style={{ color: C.muted }}>סכום ביניים: {fmtMoney(subtotal)}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>סה״כ: {fmtMoney(total)}</div>
              </div>
            </div>
          </Card>

          <Card title="אספקה ותוקף" style={{ marginBottom: 14 }}>
            <Field label="זמן אספקה / ביצוע" required>
              <Row>
                <Radio name="dm" value={deliveryMode} onChange={setDeliveryMode} options={[{ value: 'duration', label: 'תוך' }, { value: 'date', label: 'עד תאריך' }]} />
                {deliveryMode === 'duration'
                  ? <><Input type="number" min={1} value={deliveryValue} style={{ width: 90 }} onChange={(e) => setDeliveryValue(e.target.value)} /><Select value={deliveryUnit} onChange={(e) => setDeliveryUnit(e.target.value as 'days' | 'weeks')} style={{ width: 110 }}><option value="days">ימים</option><option value="weeks">שבועות</option></Select></>
                  : <Input type="date" value={deliveryDate} style={{ width: 170 }} onChange={(e) => setDeliveryDate(e.target.value)} />}
              </Row>
            </Field>
            <Field label="תוקף ההצעה (ימים)" required hint={`המזמין ביקש לפחות ${tender.proposal_validity_days} ימים`}>
              <Input type="number" min={tender.proposal_validity_days} max={365} value={validity} style={{ width: 110 }} onChange={(e) => setValidity(e.target.value)} />
            </Field>
          </Card>

          {t.requirements.length > 0 && (
            <Card title="עמידה בדרישות הסף" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.76rem', color: C.muted, marginBottom: 8 }}>תשובה «לא» מותרת — ההצעה לא נחסמת, רק מסומנת למזמין.</div>
              {t.requirements.map((r) => (
                <div key={r.id} style={{ padding: '8px 0', borderBottom: `1px dashed ${C.border}` }}>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: 6 }}>{r.label}{r.is_mandatory && <span style={{ color: C.red }}> *</span>}</div>
                  <Row>
                    <Radio name={`req-${r.id}`} value={answers[r.id]?.meets == null ? null : answers[r.id].meets ? 'yes' : 'no'} onChange={(v) => setAnswers({ ...answers, [r.id]: { ...answers[r.id], meets: v === 'yes' } })}
                      options={[{ value: 'yes', label: 'כן, עומדים' }, { value: 'no', label: 'לא' }]} />
                    <Input placeholder="הערה (לא חובה)" value={answers[r.id]?.note || ''} style={{ width: 240 }} maxLength={300} onChange={(e) => setAnswers({ ...answers, [r.id]: { ...answers[r.id], note: e.target.value } })} />
                  </Row>
                </div>
              ))}
            </Card>
          )}

          <Card title="ניסיון והערות" style={{ marginBottom: 14 }}>
            <Field label="ניסיון רלוונטי" hint={`${experience.length}/1000 · משוקלל בקריטריון «ניסיון והמלצות»`}>
              <Textarea value={experience} maxLength={1000} onChange={(e) => setExperience(e.target.value)} placeholder="פרויקטים דומים, לקוחות, ותק" />
            </Field>
            <Field label="קישורים (עד 3)" hint="אתר, תיק עבודות, המלצות">
              <div style={{ display: 'grid', gap: 6 }}>{links.map((l, i) => <Input key={i} value={l} placeholder="https://" onChange={(e) => setLinks(links.map((x, j) => j === i ? e.target.value : x))} />)}</div>
            </Field>
            <Field label="הערות והנחות" hint={`${notes.length}/2000 · למשל: «לא כולל חומרים», «מותנה בביקור באתר»`}>
              <Textarea value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            {existing ? (
              <Field label="קבצים" hint={`עד ${LIMITS.maxProposalFiles} קבצים, 15MB`}>
                <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" disabled={uploading || files.length >= LIMITS.maxProposalFiles} onChange={(e) => onFiles(e.target.files)} />
                {files.map((f) => <div key={f.id} style={{ fontSize: '0.8rem', padding: '3px 0' }}><a href="#" onClick={(e) => { e.preventDefault(); openMtFile(f.id); }}>{f.file_name}</a></div>)}
              </Field>
            ) : <div style={{ fontSize: '0.76rem', color: C.muted }}>צירוף קבצים אפשרי מיד אחרי השמירה הראשונה.</div>}
          </Card>

          <Card>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '0.84rem', lineHeight: 1.5, marginBottom: 14 }}>
              <input type="checkbox" checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} style={{ marginTop: 3 }} />
              <span>ההצעה נכונה ואני מוסמך/ת להגישה בשם העסק. ידוע לי שההצעה חתומה עד המועד האחרון ותוצג למזמין רק אז.</span>
            </label>
            <Row style={{ justifyContent: 'space-between' }}>
              <div style={{ fontSize: '1rem', fontWeight: 800 }}>סה״כ: {fmtMoney(total)}</div>
              <Btn onClick={submit} disabled={busy || !declaration || !isOpen || total <= 0}>{busy ? 'שולח…' : existing ? 'עדכון ההצעה' : 'הגשת ההצעה'}</Btn>
            </Row>
          </Card>
        </div>

        <aside style={{ flex: '0 0 260px', position: 'sticky', top: 16 }}>
          <Card title="המיני־מכרז" style={{ fontSize: '0.8rem' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{tender.title}</div>
            <div style={{ color: C.muted }}>מועד אחרון: {fmtDateTime(tender.deadline_at)}</div>
            <div style={{ color: C.amber, fontWeight: 700 }}>{timeLeft(tender.deadline_at)}</div>
            <div style={{ marginTop: 8, color: C.muted }}>{tender.proposals_count} הצעות הוגשו עד כה</div>
            <div style={{ marginTop: 8 }}><a href={`/mt/${id}`}>לפרטים המלאים ←</a></div>
          </Card>
        </aside>
      </div>
    </InternalShell>
  );
}

export default function ProposePage() {
  return <Suspense fallback={null}><ProposeInner /></Suspense>;
}
