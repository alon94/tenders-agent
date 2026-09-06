'use client';
// /mt/[id]/edit — אשף יצירת מיני־מכרז (5 שלבים + תצוגה מקדימה ופרסום).
// שמירה אוטומטית של הטיוטה (debounce 2s) דרך PATCH /api/mt/[id].
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import InternalShell from '../../../components/InternalShell';
import { CATEGORY_OPTIONS, DOMAINS } from '../../../lib/domains';
import {
  CRITERIA_LABEL, ENGAGEMENT_LABEL, PAYMENT_LABEL, PRICING_LABEL, REGIONS, REQ_KIND_LABEL, UNIT_LABEL,
  defaultDeadline, errMessage, fmtBudget, fmtDateTime, fromLocalInput, isWeekend, mtFetch, openMtFile, regionLabel, toLocalInput, uploadMtFile,
} from '../../../lib/mt/client';
import {
  ENGAGEMENT_TYPES, LIMITS, PAYMENT_TERMS, PRICING_MODES, UNITS,
  type MtAttachment, type MtEngagementType, type MtItem, type MtPaymentTerms, type MtPricingMode, type MtReqKind, type MtRequirement, type MtTender, type MtUnit,
} from '../../../lib/mt/types';
import { Btn, C, Card, Field, Input, KV, Notice, Radio, Row, Select, SignInPrompt, Spinner, Textarea, Toggle, useNow, useSession } from '../../ui';

type Draft = Pick<MtTender,
  'title' | 'category_ids' | 'engagement_type' | 'description' | 'region' | 'city' | 'is_remote' | 'budget_min' | 'budget_max' | 'budget_visible' |
  'vat_included' | 'pricing_mode' | 'criteria_weights' | 'payment_terms' | 'is_anonymous' | 'allow_split_award' | 'deadline_at' | 'questions_close_at' |
  'desired_start_mode' | 'desired_start' | 'proposal_validity_days'>;
type ItemDraft = { description: string; quantity: number; unit: MtUnit; is_optional: boolean };
type ReqDraft = { kind: MtReqKind; label: string; is_mandatory: boolean };
type Invite = { name: string; email: string; phone: string };

const STEPS = ['מה אתם צריכים?', 'היקף ותקציב', 'דרישות ותנאים', 'לוח זמנים', 'למי לשלוח', 'תצוגה מקדימה ופרסום'];
const REQ_PRESETS: { kind: MtReqKind; label: string }[] = [
  { kind: 'licensed_dealer', label: 'עוסק מורשה או חברה בע״מ' },
  { kind: 'insurance', label: 'ביטוח אחריות מקצועית / צד ג׳ בתוקף' },
  { kind: 'professional_license', label: 'רישיון מקצועי רלוונטי' },
  { kind: 'years_experience', label: 'ניסיון של 3 שנים לפחות בתחום' },
  { kind: 'references', label: 'שתי המלצות מלקוחות קודמים' },
];
const catLabel = (c: string) => DOMAINS.find((d) => d.id === c)?.label || c;

function pickDraft(t: MtTender): Draft {
  return {
    title: t.title, category_ids: t.category_ids, engagement_type: t.engagement_type, description: t.description, region: t.region, city: t.city,
    is_remote: t.is_remote, budget_min: t.budget_min, budget_max: t.budget_max, budget_visible: t.budget_visible, vat_included: t.vat_included,
    pricing_mode: t.pricing_mode, criteria_weights: t.criteria_weights, payment_terms: t.payment_terms, is_anonymous: t.is_anonymous,
    allow_split_award: t.allow_split_award, deadline_at: t.deadline_at, questions_close_at: t.questions_close_at,
    desired_start_mode: t.desired_start_mode, desired_start: t.desired_start, proposal_validity_days: t.proposal_validity_days,
  };
}

export default function MtEdit() {
  const { id } = useParams<{ id: string }>();
  const { session, ready } = useSession();
  const now = useNow();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [tender, setTender] = useState<MtTender | null>(null);
  const [form, setForm] = useState<Draft | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [reqs, setReqs] = useState<ReqDraft[]>([]);
  const [files, setFiles] = useState<MtAttachment[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [publicLink, setPublicLink] = useState(false);
  const [step, setStep] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [saveErr, setSaveErr] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<{ matched: number; public_link: string | null; invitations: { link: string; email: string | null; phone: string | null }[] } | null>(null);
  const [aiBrief, setAiBrief] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- טעינה ----------
  useEffect(() => {
    if (!ready || !session) return;
    mtFetch<{ role: string; tender: MtTender; items: MtItem[]; requirements: MtRequirement[]; files: MtAttachment[] }>(`/${id}`)
      .then((r) => {
        if (r.role !== 'buyer') { window.location.replace(`/mt/${id}`); return; }
        if (r.tender.status !== 'draft') { window.location.replace(`/mt/${id}/manage`); return; }
        setTender(r.tender);
        const d = pickDraft(r.tender);
        if (!d.deadline_at) {
          d.deadline_at = defaultDeadline();
          d.questions_close_at = new Date(new Date(d.deadline_at).getTime() - LIMITS.questionsCloseBeforeHours * 3.6e6).toISOString();
          pending.current.deadline_at = d.deadline_at;
          pending.current.questions_close_at = d.questions_close_at;
        }
        setForm(d);
        setItems(r.items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unit: i.unit, is_optional: i.is_optional })));
        setReqs(r.requirements.map((q) => ({ kind: q.kind, label: q.label, is_mandatory: q.is_mandatory })));
        setFiles(r.files);
      })
      .catch((e) => setErr(errMessage(e)))
      .finally(() => setLoading(false));
  }, [ready, session, id]);

  // ---------- שמירה אוטומטית ----------
  const flush = useCallback(async () => {
    const body = pending.current;
    pending.current = {};
    if (!Object.keys(body).length) return;
    setSaveState('saving');
    try {
      await mtFetch(`/${id}`, { method: 'PATCH', body });
      setSaveState(Object.keys(pending.current).length ? 'dirty' : 'saved');
      setSaveErr('');
    } catch (e) {
      setSaveState('error'); setSaveErr(errMessage(e));
      pending.current = { ...body, ...pending.current };
    }
  }, [id]);
  const queue = useCallback((patch: Record<string, unknown>) => {
    pending.current = { ...pending.current, ...patch };
    setSaveState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 2000);
  }, [flush]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    queue({ [k]: v });
  };
  const setItemsAndSave = (next: ItemDraft[]) => { setItems(next); queue({ items: next.filter((i) => i.description.trim().length >= 2) }); };
  const setReqsAndSave = (next: ReqDraft[]) => { setReqs(next); queue({ requirements: next.filter((r) => r.label.trim().length >= 2) }); };
  const goTo = async (n: number) => { if (timer.current) clearTimeout(timer.current); await flush(); setStep(Math.max(0, Math.min(STEPS.length - 1, n))); window.scrollTo({ top: 0 }); };

  // ---------- מה חסר לפרסום (משקף את validateForPublish בשרת) ----------
  const problems = useMemo(() => {
    if (!form) return [] as string[];
    const p: string[] = [];
    if (!form.title || form.title.trim().length < 5) p.push('כותרת (לפחות 5 תווים)');
    if (!form.category_ids?.length) p.push('תחום');
    if (!form.engagement_type) p.push('סוג ההתקשרות');
    if (!form.description || form.description.length < LIMITS.descriptionMin) p.push(`תיאור (לפחות ${LIMITS.descriptionMin} תווים)`);
    if (!form.is_remote && !form.region) p.push('אזור ביצוע (או «מרחוק»)');
    const validItems = items.filter((i) => i.description.trim().length >= 2);
    if (!validItems.length) p.push('לפחות שורת דרישה אחת');
    if (!form.deadline_at) p.push('מועד אחרון להגשה');
    else {
      const h = (new Date(form.deadline_at).getTime() - now) / 3.6e6;
      if (h < LIMITS.minDeadlineHours) p.push(`מועד אחרון: לפחות ${LIMITS.minDeadlineHours} שעות מעכשיו`);
      if (h > LIMITS.maxDeadlineDays * 24) p.push(`מועד אחרון: עד ${LIMITS.maxDeadlineDays} יום`);
      if (form.questions_close_at && new Date(form.questions_close_at).getTime() > new Date(form.deadline_at).getTime() - LIMITS.questionsCloseBeforeHours * 3.6e6) {
        p.push(`סיום השאלות חייב להיות לפחות ${LIMITS.questionsCloseBeforeHours} שעות לפני המועד האחרון`);
      }
    }
    const w = form.criteria_weights;
    if (Math.round(w.price + w.delivery + w.experience + w.quality) !== 100) p.push('משקלות הקריטריונים חייבים להסתכם ל-100%');
    if (form.budget_min != null && form.budget_max != null && form.budget_max < form.budget_min) p.push('תקציב «עד» קטן מ«מ-»');
    return p;
  }, [form, items, now]);

  // ---------- AI ----------
  async function aiDraft() {
    if (aiBrief.trim().length < 15) return;
    setAiBusy(true);
    try {
      const r = await mtFetch<{ available: boolean; title?: string; description?: string; items?: { description: string; quantity: number; unit: MtUnit }[]; category_id?: string | null }>(
        '/ai-draft', { method: 'POST', body: { brief: aiBrief, tender_id: id } });
      if (!r.available) { setSaveErr('עוזר הניסוח אינו זמין כרגע — אפשר להמשיך ידנית'); return; }
      const patch: Partial<Draft> = {};
      if (r.title && !form?.title) patch.title = r.title;
      if (r.description) patch.description = r.description;
      if (r.category_id && !form?.category_ids?.length) patch.category_ids = [r.category_id];
      setForm((f) => (f ? { ...f, ...patch } : f)); queue(patch);
      if (r.items?.length && !items.length) setItemsAndSave(r.items.map((i) => ({ description: i.description, quantity: i.quantity, unit: i.unit, is_optional: false })));
    } catch (e) { setSaveErr(errMessage(e)); } finally { setAiBusy(false); }
  }

  // ---------- קבצים ----------
  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(list)) await uploadMtFile('tender', id, f);
      const r = await mtFetch<{ files: MtAttachment[] }>(`/${id}`);
      setFiles(r.files);
    } catch (e) { setSaveErr(errMessage(e)); } finally { setUploading(false); }
  }
  async function removeFile(fid: string) {
    try { await mtFetch(`/files/${fid}`, { method: 'DELETE' }); setFiles((fs) => fs.filter((f) => f.id !== fid)); } catch (e) { setSaveErr(errMessage(e)); }
  }

  // ---------- פרסום ----------
  async function publish() {
    if (timer.current) clearTimeout(timer.current);
    await flush();
    setPublishing(true); setSaveErr('');
    try {
      const r = await mtFetch<{ matched: number; public_link: string | null; invitations: { link: string; email: string | null; phone: string | null }[] }>(`/${id}/publish`, {
        method: 'POST',
        body: { accept_terms: acceptTerms, public_link_enabled: publicLink, invitations: invites.filter((i) => i.email || i.phone) },
      });
      setPublished(r);
      window.scrollTo({ top: 0 });
    } catch (e) { setSaveErr(errMessage(e)); } finally { setPublishing(false); }
  }

  // ---------- רינדור ----------
  if (!ready) return <InternalShell title="מיני־מכרז חדש"><Spinner /></InternalShell>;
  if (!session) return <InternalShell title="מיני־מכרז חדש"><SignInPrompt next={`/mt/${id}/edit`} /></InternalShell>;
  if (loading || !form || !tender) return <InternalShell title="מיני־מכרז חדש">{err ? <div style={{ padding: 22 }}><Notice kind="error">{err}</Notice></div> : <Spinner />}</InternalShell>;

  if (published) {
    const share = published.public_link || `${window.location.origin}/mt/${id}`;
    const wa = `https://wa.me/?text=${encodeURIComponent(`מזמינים אתכם להגיש הצעת מחיר: ${form.title}\n${share}`)}`;
    return (
      <InternalShell title="המיני־מכרז פורסם" subtitle={form.title}>
        <div style={{ padding: 22, maxWidth: 720 }}>
          <Card>
            <Notice kind="success">ההתראה נשלחה ל-{published.matched} עסקים רשומים בתחום ובאזור. ההצעות ייפתחו יחד ב-{fmtDateTime(form.deadline_at)}.</Notice>
            {published.public_link && (
              <Field label="קישור ציבורי לשיתוף" hint="כל מי שנכנס דרכו ונרשם נספר כמוזמן. אפשר לבטל את הקישור בכל רגע מדף הניהול.">
                <Row><Input readOnly value={published.public_link} onFocus={(e) => e.currentTarget.select()} style={{ width: 'auto', flex: 1 }} /><Btn kind="secondary" onClick={() => navigator.clipboard?.writeText(published.public_link!)}>העתקה</Btn></Row>
              </Field>
            )}
            {published.invitations.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 6 }}>הזמנות אישיות שנשלחו ({published.invitations.length})</div>
                {published.invitations.map((i, n) => (
                  <div key={n} style={{ fontSize: '0.8rem', color: C.muted, padding: '4px 0', wordBreak: 'break-all' }}>{i.email || i.phone} — <a href={i.link}>{i.link}</a></div>
                ))}
              </div>
            )}
            <Row>
              <Btn href={`/mt/${id}/manage`}>לדף הניהול</Btn>
              <Btn href={wa} kind="secondary">שיתוף בווטסאפ</Btn>
              <Btn href="/mt" kind="ghost">למיני־מכרזים שלי</Btn>
            </Row>
          </Card>
        </div>
      </InternalShell>
    );
  }

  const saveLabel = saveState === 'saving' ? 'שומר…' : saveState === 'saved' ? 'הטיוטה נשמרה' : saveState === 'dirty' ? 'שינויים לא שמורים' : saveState === 'error' ? 'שגיאה בשמירה' : '';
  const weightsSum = form.criteria_weights.price + form.criteria_weights.delivery + form.criteria_weights.experience + form.criteria_weights.quality;
  const inviteCount = invites.filter((i) => i.email || i.phone).length;

  const nav = (
    <Row style={{ justifyContent: 'space-between', marginTop: 18 }}>
      <Btn kind="secondary" onClick={() => goTo(step - 1)} disabled={step === 0}>→ הקודם</Btn>
      <span style={{ fontSize: '0.74rem', color: saveState === 'error' ? C.red : C.muted }}>{saveLabel}</span>
      {step < STEPS.length - 1 ? <Btn onClick={() => goTo(step + 1)}>הבא ←</Btn> : <span />}
    </Row>
  );

  return (
    <InternalShell title={form.title || 'מיני־מכרז חדש'} subtitle={`שלב ${step + 1} מתוך ${STEPS.length} — ${STEPS[step]}`}
      action={<Btn href="/mt" kind="ghost" small>שמירה ויציאה</Btn>}>
      <div style={{ padding: 22, display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 560px', minWidth: 0, maxWidth: 760 }}>
          <Row gap={4} style={{ marginBottom: 16 }}>
            {STEPS.map((s, i) => (
              <button key={s} type="button" onClick={() => goTo(i)} title={s} aria-label={`שלב ${i + 1}: ${s}`}
                style={{ flex: 1, height: 6, borderRadius: 3, border: 'none', cursor: 'pointer', background: i <= step ? C.blue : '#d6dde4' }} />
            ))}
          </Row>
          {saveErr && <Notice kind="error">{saveErr}</Notice>}

          {step === 0 && (
            <Card>
              <Field label="כותרת" required hint={`${form.title?.length || 0}/${LIMITS.titleMax} · מוצגת ברשימות`}>
                <Input value={form.title || ''} maxLength={LIMITS.titleMax} placeholder="למשל: שיפוץ וצביעת משרד 120 מ״ר בחיפה" onChange={(e) => set('title', e.target.value)} />
              </Field>
              <Field label="תחום" required hint="קובע למי נשלחת ההתראה. עד 2 תחומים.">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CATEGORY_OPTIONS.filter((o) => o.value !== 'other').map((o) => {
                    const on = form.category_ids.includes(o.value);
                    return (
                      <button key={o.value} type="button" onClick={() => set('category_ids', on ? form.category_ids.filter((c) => c !== o.value) : [...form.category_ids, o.value].slice(-2))}
                        style={{ padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: on ? 700 : 500,
                          border: `1.5px solid ${on ? C.blue : '#d6dde4'}`, background: on ? '#e8f1fb' : '#fff', color: on ? C.blueDark : C.dark }}>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="סוג ההתקשרות" required>
                <Radio name="engagement" value={form.engagement_type} onChange={(v) => set('engagement_type', v as MtEngagementType)}
                  options={ENGAGEMENT_TYPES.map((v) => ({ value: v, label: ENGAGEMENT_LABEL[v] }))} />
              </Field>
              <Field label="תיאור" required hint={`${form.description?.length || 0}/${LIMITS.descriptionMax} · לפחות ${LIMITS.descriptionMin} תווים: רקע, מה צריך, מה לא כלול, תוצר צפוי`}>
                <Textarea value={form.description || ''} maxLength={LIMITS.descriptionMax} style={{ minHeight: 160 }} onChange={(e) => set('description', e.target.value)} />
              </Field>
              <details style={{ marginBottom: 14, background: '#f7f9fb', borderRadius: 10, padding: '10px 14px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.83rem', color: C.blueDark }}>✨ נסח לי עם AI</summary>
                <div style={{ marginTop: 10 }}>
                  <Textarea value={aiBrief} placeholder="כתבו 2–3 משפטים: מה צריך, איפה, מתי. המערכת תציע כותרת, תיאור מובנה ושורות דרישה — ואתם עורכים." style={{ minHeight: 80, marginBottom: 8 }} onChange={(e) => setAiBrief(e.target.value)} />
                  <Btn small onClick={aiDraft} disabled={aiBusy || aiBrief.trim().length < 15}>{aiBusy ? 'מנסח…' : 'הצע ניסוח'}</Btn>
                </div>
              </details>
              <Field label="מיקום ביצוע" required>
                <Row>
                  <Select value={form.region || ''} disabled={form.is_remote} onChange={(e) => set('region', e.target.value || null)} style={{ width: 180 }}>
                    <option value="">בחרו אזור</option>
                    {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </Select>
                  <Input value={form.city || ''} disabled={form.is_remote} placeholder="עיר (לא חובה)" style={{ width: 200 }} onChange={(e) => set('city', e.target.value || null)} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83rem' }}>
                    <input type="checkbox" checked={form.is_remote} onChange={(e) => set('is_remote', e.target.checked)} /> מרחוק / לא רלוונטי
                  </label>
                </Row>
              </Field>
              {nav}
            </Card>
          )}

          {step === 1 && (
            <Card>
              <Field label="שורות דרישה" required hint={`כל שורה תקבל מחיר נפרד מהמציע. עד ${LIMITS.maxItems} שורות.`}>
                <div style={{ display: 'grid', gap: 8 }}>
                  {items.map((it, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) 90px 120px auto auto', gap: 6, alignItems: 'center' }}>
                      <Input value={it.description} placeholder={`שורה ${i + 1} — למשל: צביעת קירות`} onChange={(e) => setItemsAndSave(items.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                      <Input type="number" min={0.01} step="any" value={it.quantity} aria-label="כמות" onChange={(e) => setItemsAndSave(items.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} />
                      <Select value={it.unit} aria-label="יחידה" onChange={(e) => setItemsAndSave(items.map((x, j) => j === i ? { ...x, unit: e.target.value as MtUnit } : x))}>
                        {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
                      </Select>
                      <label title="המציע רשאי לא לתמחר שורה זו" style={{ fontSize: '0.72rem', display: 'flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap' }}>
                        <input type="checkbox" checked={it.is_optional} onChange={(e) => setItemsAndSave(items.map((x, j) => j === i ? { ...x, is_optional: e.target.checked } : x))} /> אופציונלי
                      </label>
                      <button type="button" aria-label="מחיקת שורה" onClick={() => setItemsAndSave(items.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', color: C.red, cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
                <Btn small kind="secondary" style={{ marginTop: 8 }} disabled={items.length >= LIMITS.maxItems}
                  onClick={() => setItemsAndSave([...items, { description: '', quantity: 1, unit: 'lump_sum', is_optional: false }])}>+ הוספת שורה</Btn>
              </Field>
              <Field label="תקציב משוער (₪)" hint="תקציב גלוי מביא הצעות מדויקות יותר. מוצג למציעים כטווח בלבד.">
                <Row>
                  <Input type="number" min={0} placeholder="מ-" value={form.budget_min ?? ''} style={{ width: 140 }} onChange={(e) => set('budget_min', e.target.value === '' ? null : Number(e.target.value))} />
                  <Input type="number" min={0} placeholder="עד" value={form.budget_max ?? ''} style={{ width: 140 }} onChange={(e) => set('budget_max', e.target.value === '' ? null : Number(e.target.value))} />
                </Row>
              </Field>
              <Toggle checked={form.budget_visible} onChange={(v) => set('budget_visible', v)} label="להציג את התקציב למציעים" />
              <Field label="מע״מ" required>
                <Radio name="vat" value={form.vat_included ? 'inc' : 'exc'} onChange={(v) => set('vat_included', v === 'inc')}
                  options={[{ value: 'exc', label: 'מחירים לפני מע״מ' }, { value: 'inc', label: 'מחירים כוללים מע״מ' }]} />
              </Field>
              <Field label="אופן תמחור מבוקש" required hint="קובע איך טופס ההצעה ייראה למציע">
                <Radio name="pricing" value={form.pricing_mode} onChange={(v) => set('pricing_mode', v as MtPricingMode)}
                  options={PRICING_MODES.map((v) => ({ value: v, label: PRICING_LABEL[v] }))} />
              </Field>
              <Toggle checked={form.allow_split_award} onChange={(v) => set('allow_split_award', v)} label="לאפשר פיצול זכייה" hint="בחירת זוכה שונה לשורות דרישה שונות (מתקדם)" />
              {nav}
            </Card>
          )}

          {step === 2 && (
            <Card>
              <Field label="דרישות סף" hint="כל דרישה הופכת לשאלה כן/לא בטופס ההצעה. «חובה» = תשובה «לא» תסומן בהשוואה כאי-עמידה.">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {REQ_PRESETS.map((p) => {
                    const on = reqs.some((r) => r.kind === p.kind);
                    return <button key={p.kind} type="button" onClick={() => setReqsAndSave(on ? reqs.filter((r) => r.kind !== p.kind) : [...reqs, { ...p, is_mandatory: true }])}
                      style={{ padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', border: `1.5px solid ${on ? C.blue : '#d6dde4'}`, background: on ? '#e8f1fb' : '#fff', color: on ? C.blueDark : C.dark, fontWeight: on ? 700 : 500 }}>
                      {REQ_KIND_LABEL[p.kind]}
                    </button>;
                  })}
                  <Btn small kind="secondary" onClick={() => setReqsAndSave([...reqs, { kind: 'custom', label: '', is_mandatory: false }])}>+ דרישה אחרת</Btn>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {reqs.map((r, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6, alignItems: 'center' }}>
                      <Input value={r.label} placeholder="נוסח הדרישה כפי שיוצג למציע" onChange={(e) => setReqsAndSave(reqs.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                      <label style={{ fontSize: '0.75rem', display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input type="checkbox" checked={r.is_mandatory} onChange={(e) => setReqsAndSave(reqs.map((x, j) => j === i ? { ...x, is_mandatory: e.target.checked } : x))} /> חובה
                      </label>
                      <button type="button" aria-label="מחיקה" onClick={() => setReqsAndSave(reqs.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', color: C.red, cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
              </Field>
              <Field label="קריטריוני בחירה" required hint={`מוצגים למציעים ומשמשים לניקוד המשוקלל. סכום: ${weightsSum}% ${weightsSum === 100 ? '✓' : '(חייב 100%)'}`}>
                {(Object.keys(CRITERIA_LABEL) as (keyof typeof CRITERIA_LABEL)[]).map((k) => (
                  <div key={k} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 50px', gap: 10, alignItems: 'center', marginBottom: 6, fontSize: '0.83rem' }}>
                    <span>{CRITERIA_LABEL[k]}</span>
                    <input type="range" min={0} max={100} step={5} value={form.criteria_weights[k]} aria-label={CRITERIA_LABEL[k]} onChange={(e) => set('criteria_weights', { ...form.criteria_weights, [k]: Number(e.target.value) })} />
                    <b>{form.criteria_weights[k]}%</b>
                  </div>
                ))}
              </Field>
              <Field label="תנאי תשלום">
                <Select value={form.payment_terms || ''} onChange={(e) => set('payment_terms', (e.target.value || null) as MtPaymentTerms | null)} style={{ width: 240 }}>
                  <option value="">לא צוין</option>
                  {PAYMENT_TERMS.map((p) => <option key={p} value={p}>{PAYMENT_LABEL[p]}</option>)}
                </Select>
              </Field>
              <Field label="קבצים מצורפים" hint={`עד ${LIMITS.maxTenderFiles} קבצים, 15MB כל אחד: PDF, תמונות, Word, Excel`}>
                <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" disabled={uploading || files.length >= LIMITS.maxTenderFiles} onChange={(e) => onFiles(e.target.files)} />
                {uploading && <div style={{ fontSize: '0.75rem', color: C.muted }}>מעלה…</div>}
                <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                  {files.map((f) => (
                    <Row key={f.id} style={{ fontSize: '0.8rem' }}>
                      <a href="#" onClick={(e) => { e.preventDefault(); openMtFile(f.id); }}>{f.file_name}</a>
                      <span style={{ color: C.muted }}>{Math.round(f.size_bytes / 1024)} KB</span>
                      <button type="button" onClick={() => removeFile(f.id)} style={{ border: 'none', background: 'transparent', color: C.red, cursor: 'pointer', fontFamily: 'inherit' }}>הסרה</button>
                    </Row>
                  ))}
                </div>
              </Field>
              <Toggle checked={form.is_anonymous} onChange={(v) => set('is_anonymous', v)} label="פרסום אנונימי" hint="המציעים יראו «עסק בתחום X מאזור Y». שם העסק נחשף רק לזוכה." />
              {nav}
            </Card>
          )}

          {step === 3 && (
            <Card>
              <Field label="מועד אחרון להגשה" required hint={`בין ${LIMITS.minDeadlineHours} שעות ל-${LIMITS.maxDeadlineDays} יום מעכשיו. ההצעות חתומות עד אז ונפתחות יחד.`}
                error={isWeekend(form.deadline_at) ? 'שימו לב: המועד נופל בשישי/שבת' : null}>
                <Input type="datetime-local" value={toLocalInput(form.deadline_at)} style={{ width: 240 }} onChange={(e) => {
                  const iso = fromLocalInput(e.target.value); set('deadline_at', iso);
                  if (iso) set('questions_close_at', new Date(new Date(iso).getTime() - LIMITS.questionsCloseBeforeHours * 3.6e6).toISOString());
                }} />
              </Field>
              <Field label="סיום תקופת השאלות" required hint="ברירת מחדל: 24 שעות לפני המועד. לא ניתן לאחר מזה.">
                <Input type="datetime-local" value={toLocalInput(form.questions_close_at)} style={{ width: 240 }} onChange={(e) => set('questions_close_at', fromLocalInput(e.target.value))} />
              </Field>
              <Field label="מועד תחילת עבודה רצוי">
                <Row>
                  <Radio name="start" value={form.desired_start_mode} onChange={(v) => set('desired_start_mode', v as Draft['desired_start_mode'])}
                    options={[{ value: 'asap', label: 'מיד' }, { value: 'flexible', label: 'גמיש' }, { value: 'date', label: 'בתאריך' }]} />
                  {form.desired_start_mode === 'date' && <Input type="date" value={form.desired_start || ''} style={{ width: 170 }} onChange={(e) => set('desired_start', e.target.value || null)} />}
                </Row>
              </Field>
              <Field label="תוקף הצעות נדרש (ימים)" hint="המציע יכול להאריך, לא לקצר">
                <Input type="number" min={1} max={365} value={form.proposal_validity_days} style={{ width: 120 }} onChange={(e) => set('proposal_validity_days', Math.max(1, Number(e.target.value) || 30))} />
              </Field>
              {nav}
            </Card>
          )}

          {step === 4 && (
            <Card>
              <Notice>עסקים רשומים בתחום {form.category_ids.map(catLabel).join(' / ') || '—'}{form.is_remote ? '' : ` באזור ${regionLabel(form.region) || '—'}`} יקבלו התראה אוטומטית עם הפרסום.</Notice>
              <Field label="הזמנה ישירה" hint={`ספקים שאתם מכירים — כל אחד יקבל קישור אישי במייל. עד ${LIMITS.maxInvitations}.`}>
                <div style={{ display: 'grid', gap: 6 }}>
                  {invites.map((inv, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr auto', gap: 6 }}>
                      <Input placeholder="שם" value={inv.name} onChange={(e) => setInvites(invites.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                      <Input placeholder="מייל" type="email" value={inv.email} onChange={(e) => setInvites(invites.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
                      <Input placeholder="טלפון" value={inv.phone} onChange={(e) => setInvites(invites.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} />
                      <button type="button" aria-label="הסרה" onClick={() => setInvites(invites.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', color: C.red, cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
                <Btn small kind="secondary" style={{ marginTop: 8 }} disabled={invites.length >= LIMITS.maxInvitations} onClick={() => setInvites([...invites, { name: '', email: '', phone: '' }])}>+ הוספת מוזמן</Btn>
              </Field>
              <Toggle checked={publicLink} onChange={setPublicLink} label="קישור ציבורי לשיתוף" hint="קישור אחד לווטסאפ / קבוצות. כל מי שנכנס דרכו ונרשם — נספר כמוזמן. ניתן לבטל בכל רגע." />
              {nav}
            </Card>
          )}

          {step === 5 && (
            <>
              <Card title="כך יראה המיני־מכרז למציעים" style={{ marginBottom: 14 }}>
                <KV k="כותרת" v={form.title || '—'} />
                <KV k="מזמין" v={form.is_anonymous ? `עסק בתחום ${form.category_ids.map(catLabel).join(', ')} (אנונימי)` : session.user.email} />
                <KV k="תחום" v={form.category_ids.map(catLabel).join(', ') || '—'} />
                <KV k="סוג התקשרות" v={form.engagement_type ? ENGAGEMENT_LABEL[form.engagement_type] : '—'} />
                <KV k="מיקום" v={form.is_remote ? 'מרחוק' : [regionLabel(form.region), form.city].filter(Boolean).join(', ') || '—'} />
                <KV k="תיאור" v={<div style={{ whiteSpace: 'pre-wrap' }}>{form.description || '—'}</div>} />
                <KV k="שורות דרישה" v={<ul style={{ margin: 0, paddingInlineStart: 18 }}>{items.map((it, i) => <li key={i}>{it.description} — {it.quantity} {UNIT_LABEL[it.unit]}{it.is_optional ? ' (אופציונלי)' : ''}</li>)}</ul>} />
                <KV k="תקציב" v={form.budget_visible ? fmtBudget(form.budget_min, form.budget_max) : <span style={{ color: C.muted }}>מוסתר מהמציעים</span>} />
                <KV k="תמחור" v={`${PRICING_LABEL[form.pricing_mode]} · ${form.vat_included ? 'כולל מע״מ' : 'לפני מע״מ'}`} />
                <KV k="דרישות סף" v={reqs.length ? <ul style={{ margin: 0, paddingInlineStart: 18 }}>{reqs.map((r, i) => <li key={i}>{r.label}{r.is_mandatory ? ' (חובה)' : ''}</li>)}</ul> : 'אין'} />
                <KV k="קריטריונים" v={(Object.keys(CRITERIA_LABEL) as (keyof typeof CRITERIA_LABEL)[]).map((k) => `${CRITERIA_LABEL[k]} ${form.criteria_weights[k]}%`).join(' · ')} />
                <KV k="תנאי תשלום" v={form.payment_terms ? PAYMENT_LABEL[form.payment_terms] : 'לא צוין'} />
                <KV k="מועד אחרון" v={fmtDateTime(form.deadline_at)} />
                <KV k="שאלות עד" v={fmtDateTime(form.questions_close_at)} />
                <KV k="קבצים" v={files.length ? files.map((f) => f.file_name).join(', ') : 'אין'} />
                <KV k="הפצה" v={`התראה לעסקים רשומים${inviteCount ? ` · ${inviteCount} הזמנות ישירות` : ''}${publicLink ? ' · קישור ציבורי' : ''}`} />
              </Card>
              {problems.length > 0 && (
                <Notice kind="warn">
                  <b>לפני הפרסום יש להשלים:</b>
                  <ul style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
                </Notice>
              )}
              <Card>
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '0.83rem', lineHeight: 1.5, marginBottom: 14 }}>
                  <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>אני מאשר/ת את <a href="/terms" target="_blank" rel="noreferrer">תנאי השימוש</a> למיני־מכרזים: הפלטפורמה אינה צד לעסקה, ההצעות אינן חוזה, וההתקשרות נעשית ישירות בין הצדדים.</span>
                </label>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Btn kind="secondary" onClick={() => goTo(step - 1)}>→ הקודם</Btn>
                  <Btn onClick={publish} disabled={publishing || !acceptTerms || problems.length > 0}>{publishing ? 'מפרסם…' : 'פרסם מיני־מכרז'}</Btn>
                </Row>
              </Card>
            </>
          )}
        </div>

        <aside style={{ flex: '0 0 250px', position: 'sticky', top: 16 }}>
          <Card title="סיכום" style={{ fontSize: '0.8rem' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <div><span style={{ color: C.muted }}>כותרת: </span>{form.title || '—'}</div>
              <div><span style={{ color: C.muted }}>תחום: </span>{form.category_ids.map(catLabel).join(', ') || '—'}</div>
              <div><span style={{ color: C.muted }}>שורות: </span>{items.length}</div>
              <div><span style={{ color: C.muted }}>תקציב: </span>{fmtBudget(form.budget_min, form.budget_max)}</div>
              <div><span style={{ color: C.muted }}>מועד אחרון: </span>{fmtDateTime(form.deadline_at)}</div>
              <div><span style={{ color: C.muted }}>קבצים: </span>{files.length}</div>
            </div>
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
              {problems.length === 0 ? <span style={{ color: C.green, fontWeight: 700 }}>✓ מוכן לפרסום</span>
                : <span style={{ color: C.amber }}>נותרו {problems.length} דברים להשלמה</span>}
            </div>
            <div style={{ marginTop: 6, color: saveState === 'error' ? C.red : C.muted }}>{saveLabel}</div>
          </Card>
        </aside>
      </div>
    </InternalShell>
  );
}
