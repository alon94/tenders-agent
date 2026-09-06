'use client';
// /mt/[id]/manage — דף הניהול של המזמין בזמן שהמיני־מכרז פתוח (וגם אחרי: קיצור להשוואה)
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import InternalShell from '../../../components/InternalShell';
import { CLOSED_REASON_LABEL, errMessage, fmtDateTime, fromLocalInput, mtFetch, openMtFile, timeLeft, toLocalInput, uploadMtFile } from '../../../lib/mt/client';
import { CLOSED_REASONS, LIMITS, type MtAttachment, type MtClosedReason, type MtInvitation, type MtItem, type MtQuestion, type MtRequirement, type MtTender } from '../../../lib/mt/types';
import TenderDetails from '../../TenderDetails';
import { Badge, Btn, C, Card, Field, Input, Modal, Notice, Row, Select, SignInPrompt, Spinner, Stat, StatusBadge, Textarea, Toggle, useSession } from '../../ui';

type Resp = { role: 'buyer' | 'bidder'; tender: MtTender; items: MtItem[]; requirements: MtRequirement[]; files: MtAttachment[]; questions: MtQuestion[] };
type InvResp = { public_link: string | null; invitations: (MtInvitation & { link: string })[] };

export default function ManagePage() {
  const { id } = useParams<{ id: string }>();
  const { session, ready } = useSession();
  const [data, setData] = useState<Resp | null>(null);
  const [inv, setInv] = useState<InvResp | null>(null);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'overview' | 'questions' | 'invites' | 'edit'>('overview');
  // שאלות
  const [answerFor, setAnswerFor] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerPublish, setAnswerPublish] = useState(true);
  const [answerUpdate, setAnswerUpdate] = useState(false);
  const [clarText, setClarText] = useState('');
  const [clarUpdate, setClarUpdate] = useState(false);
  // הזמנות
  const [newInv, setNewInv] = useState({ name: '', email: '', phone: '' });
  // עריכה
  const [descUpdate, setDescUpdate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [newDeadline, setNewDeadline] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<MtClosedReason>('found_elsewhere');
  const [cancelNote, setCancelNote] = useState('');

  const load = useCallback(async () => {
    const r = await mtFetch<Resp>(`/${id}`);
    if (r.role !== 'buyer') { window.location.replace(`/mt/${id}`); return; }
    if (r.tender.status === 'draft') { window.location.replace(`/mt/${id}/edit`); return; }
    setData(r);
    mtFetch<InvResp>(`/${id}/invitations`).then(setInv).catch(() => {});
  }, [id]);
  useEffect(() => { if (ready && session) Promise.resolve().then(load).catch((e) => setErr(errMessage(e))); }, [ready, session, load]);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true); setErr(''); setFlash('');
    try { await fn(); await load(); if (ok) setFlash(ok); } catch (e) { setErr(errMessage(e)); } finally { setBusy(false); }
  }

  if (!ready) return <InternalShell title="ניהול מיני־מכרז"><Spinner /></InternalShell>;
  if (!session) return <InternalShell title="ניהול מיני־מכרז"><SignInPrompt next={`/mt/${id}/manage`} /></InternalShell>;
  if (!data) return <InternalShell title="ניהול מיני־מכרז">{err ? <div style={{ padding: 22 }}><Notice kind="error">{err}</Notice></div> : <Spinner />}</InternalShell>;

  const t = data.tender;
  const isOpen = t.status === 'open';
  const pending = data.questions.filter((q) => q.question_text && !q.answer_text);
  const opened = (inv?.invitations || []).filter((i) => i.opened_at || i.status === 'opened' || i.status === 'submitted').length;
  const canExtend = (isOpen || t.status === 'expired') && !t.extended_once_at && t.proposals_count < LIMITS.extendAllowedBelowProposals;
  const tabBtn = (k: typeof tab, label: string, count?: number) => (
    <button type="button" onClick={() => setTab(k)} style={{ padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem',
      fontWeight: tab === k ? 800 : 600, color: tab === k ? C.blueDark : C.muted, borderBottom: tab === k ? `3px solid ${C.blue}` : '3px solid transparent' }}>
      {label}{count ? <Badge fg="#fff" bg={C.red}>{count}</Badge> : null}
    </button>
  );

  return (
    <InternalShell title={t.title} subtitle={isOpen ? `פתוח להצעות · ${timeLeft(t.deadline_at)} · מועד אחרון ${fmtDateTime(t.deadline_at)}` : undefined}
      action={<Row>{['evaluating', 'awarded', 'no_award', 'completed'].includes(t.status) && <Btn href={`/mt/${id}/compare`}>השוואה ובחירה</Btn>}<Btn href={`/mt/${id}`} kind="secondary" small>תצוגת המציע</Btn></Row>}>
      <div style={{ padding: 22, maxWidth: 1000 }}>
        {err && <Notice kind="error">{err}</Notice>}
        {flash && <Notice kind="success">{flash}</Notice>}
        {t.status === 'evaluating' && <Notice kind="warn">המועד עבר — המיני־מכרז נסגר עם {t.proposals_count} הצעות. <a href={`/mt/${id}/compare`}>להשוואה ולבחירה ←</a></Notice>}
        {t.status === 'expired' && <Notice kind="warn">המועד עבר ולא התקבלו הצעות. {canExtend ? 'אפשר להאריך את המועד פעם אחת.' : 'אפשר לשכפל ולפרסם מחדש.'}</Notice>}
        {t.status === 'cancelled' && <Notice>המיני־מכרז בוטל ({t.closed_reason ? CLOSED_REASON_LABEL[t.closed_reason] : ''}).</Notice>}

        <Row gap={10} style={{ marginBottom: 16 }}>
          <Stat value={t.proposals_count} label="הצעות התקבלו" />
          <Stat value={t.views_count} label="צפיות" />
          <Stat value={inv ? `${opened}/${inv.invitations.length}` : '—'} label="מוזמנים פתחו את הקישור" />
          <Stat value={<StatusBadge status={t.status} />} label="סטטוס" />
        </Row>
        {isOpen && <div style={{ fontSize: '0.76rem', color: C.muted, marginBottom: 14 }}>עד המועד האחרון נחשף רק המספר — לא מי הגיש ולא כמה. ההצעות ייפתחו יחד ב-{fmtDateTime(t.deadline_at)}.</div>}

        <Row gap={0} style={{ borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
          {tabBtn('overview', 'פרטים')}
          {tabBtn('questions', 'שאלות והבהרות', pending.length)}
          {tabBtn('invites', 'הפצה והזמנות')}
          {tabBtn('edit', 'עריכה וסגירה')}
        </Row>

        {tab === 'overview' && (
          <TenderDetails tender={{ ...t, buyer: { anonymous: t.is_anonymous, categories: [], region: t.region, email: session.user.email } }} items={data.items} requirements={data.requirements} files={data.files} questions={data.questions} />
        )}

        {tab === 'questions' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <Card title="שאלות שהתקבלו">
              {data.questions.filter((q) => q.question_text).length === 0 && <div style={{ color: C.muted, fontSize: '0.84rem' }}>עדיין לא התקבלו שאלות.</div>}
              {data.questions.filter((q) => q.question_text).map((q) => (
                <div key={q.id} id={`q-${q.id}`} style={{ padding: '10px 0', borderBottom: `1px dashed ${C.border}`, fontSize: '0.84rem' }}>
                  <div style={{ color: C.muted, fontSize: '0.74rem' }}>{fmtDateTime(q.created_at)} {q.answer_text ? (q.is_published ? <Badge fg={C.green} bg={C.greenPale}>הבהרה {q.clarification_number}</Badge> : <Badge>נענתה בפרטי</Badge>) : <Badge fg={C.amber} bg={C.amberPale}>ממתינה למענה</Badge>}</div>
                  <div style={{ margin: '4px 0' }}><b>שאלה:</b> {q.question_text}</div>
                  {q.answer_text && <div style={{ whiteSpace: 'pre-wrap' }}><b>תשובה:</b> {q.answer_text}</div>}
                  {!q.answer_text && isOpen && (answerFor === q.id ? (
                    <div style={{ marginTop: 8, background: '#f7f9fb', borderRadius: 10, padding: 12 }}>
                      <Textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="התשובה" style={{ minHeight: 80, marginBottom: 8 }} maxLength={3000} />
                      <Toggle checked={answerPublish} onChange={setAnswerPublish} label="לפרסם כהבהרה לכל המציעים" hint="מומלץ. אחרת — התשובה נשלחת רק לשואל." />
                      {answerPublish && <Toggle checked={answerUpdate} onChange={setAnswerUpdate} label="ההבהרה משמעותית — לבקש מהמציעים לאשר/לעדכן הצעות" />}
                      <Row><Btn small disabled={busy || answerText.trim().length < 1} onClick={() => run(() => mtFetch(`/questions/${q.id}/answer`, { method: 'POST', body: { text: answerText, publish: answerPublish, requires_proposal_update: answerUpdate } }).then(() => { setAnswerFor(null); setAnswerText(''); }), 'התשובה נשלחה')}>{busy ? 'שולח…' : 'שליחה'}</Btn><Btn small kind="ghost" onClick={() => setAnswerFor(null)}>ביטול</Btn></Row>
                    </div>
                  ) : <Btn small kind="secondary" style={{ marginTop: 6 }} onClick={() => { setAnswerFor(q.id); setAnswerText(''); }}>ענה</Btn>)}
                </div>
              ))}
            </Card>
            {isOpen && (
              <Card title="הבהרה יזומה">
                <div style={{ fontSize: '0.78rem', color: C.muted, marginBottom: 8 }}>מתפרסמת לכל המציעים כ«הבהרה N» ושולחת התראה לכל מי שהגיש או צפה.</div>
                <Textarea value={clarText} onChange={(e) => setClarText(e.target.value)} style={{ minHeight: 80, marginBottom: 8 }} maxLength={3000} />
                <Toggle checked={clarUpdate} onChange={setClarUpdate} label="דורש עדכון הצעות" />
                <Btn small disabled={busy || clarText.trim().length < 3} onClick={() => run(() => mtFetch(`/${id}/questions`, { method: 'POST', body: { text: clarText, requires_proposal_update: clarUpdate } }).then(() => setClarText('')), 'ההבהרה פורסמה')}>פרסום הבהרה</Btn>
              </Card>
            )}
          </div>
        )}

        {tab === 'invites' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <Card title="קישור ציבורי">
              <Toggle checked={t.public_link_enabled} onChange={(v) => run(() => mtFetch(`/${id}`, { method: 'PATCH', body: { public_link_enabled: v } }), v ? 'הקישור הציבורי הופעל' : 'הקישור הציבורי בוטל')} label="קישור ציבורי פעיל" hint="לשיתוף בווטסאפ / קבוצות. כל מי שנכנס דרכו ונרשם נספר כמוזמן." />
              {t.public_link_enabled && inv?.public_link && (
                <Row><Input readOnly value={inv.public_link} onFocus={(e) => e.currentTarget.select()} style={{ width: 'auto', flex: 1 }} /><Btn small kind="secondary" onClick={() => navigator.clipboard?.writeText(inv.public_link!)}>העתקה</Btn>
                  <Btn small kind="secondary" href={`https://wa.me/?text=${encodeURIComponent(`מזמינים אתכם להגיש הצעת מחיר: ${t.title}\n${inv.public_link}`)}`}>ווטסאפ</Btn></Row>
              )}
            </Card>
            <Card title={`הזמנות ישירות (${inv?.invitations.length ?? 0}/${LIMITS.maxInvitations})`}>
              {(inv?.invitations || []).map((i) => (
                <Row key={i.id} style={{ padding: '6px 0', borderBottom: `1px dashed ${C.border}`, fontSize: '0.82rem' }}>
                  <span style={{ flex: '1 1 200px' }}>{i.invitee_name || '—'} · {i.invitee_email || i.invitee_phone}</span>
                  <Badge fg={i.status === 'submitted' ? C.green : i.status === 'opened' ? C.blueDark : C.muted} bg={i.status === 'submitted' ? C.greenPale : i.status === 'opened' ? '#e8f1fb' : C.bg}>
                    {{ sent: 'נשלחה', opened: 'נפתחה', registered: 'נרשם', submitted: 'הגיש הצעה', declined: 'סירב', revoked: 'בוטלה' }[i.status] || i.status}
                  </Badge>
                  {i.status !== 'revoked' && <Btn small kind="ghost" onClick={() => run(() => mtFetch(`/${id}/invitations?id=${i.id}`, { method: 'DELETE' }), 'ההזמנה בוטלה')}>ביטול</Btn>}
                </Row>
              ))}
              {isOpen && (
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr auto', gap: 6, alignItems: 'center' }}>
                  <Input placeholder="שם" value={newInv.name} onChange={(e) => setNewInv({ ...newInv, name: e.target.value })} />
                  <Input placeholder="מייל" type="email" value={newInv.email} onChange={(e) => setNewInv({ ...newInv, email: e.target.value })} />
                  <Input placeholder="טלפון" value={newInv.phone} onChange={(e) => setNewInv({ ...newInv, phone: e.target.value })} />
                  <Btn small disabled={busy || (!newInv.email && !newInv.phone)} onClick={() => run(() => mtFetch(`/${id}/invitations`, { method: 'POST', body: { list: [newInv] } }).then(() => setNewInv({ name: '', email: '', phone: '' })), 'ההזמנה נשלחה')}>הזמנה</Btn>
                </div>
              )}
            </Card>
          </div>
        )}

        {tab === 'edit' && (
          <div style={{ display: 'grid', gap: 14 }}>
            {isOpen && (
              <Card title="תוספת לתיאור">
                <div style={{ fontSize: '0.78rem', color: C.muted, marginBottom: 8 }}>אחרי הפרסום אפשר רק להוסיף — התוספת מסומנת כעדכון ונשלחת למי שהגיש. שינוי שורות דרישה או תקציב: «בטל ופרסם מחדש».</div>
                <Textarea value={descUpdate} onChange={(e) => setDescUpdate(e.target.value)} style={{ minHeight: 80, marginBottom: 8 }} maxLength={1500} />
                <Btn small disabled={busy || descUpdate.trim().length < 5} onClick={() => run(() => mtFetch(`/${id}`, { method: 'PATCH', body: { description_update: descUpdate } }).then(() => setDescUpdate('')), 'העדכון נוסף')}>הוספת עדכון</Btn>
              </Card>
            )}
            {isOpen && (
              <Card title={`קבצים (${data.files.length}/${LIMITS.maxTenderFiles})`}>
                {data.files.map((f) => <div key={f.id} style={{ fontSize: '0.82rem', padding: '3px 0' }}><a href="#" onClick={(e) => { e.preventDefault(); openMtFile(f.id); }}>{f.file_name}</a></div>)}
                <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" disabled={uploading || data.files.length >= LIMITS.maxTenderFiles} style={{ marginTop: 8 }}
                  onChange={async (e) => { const list = e.target.files; if (!list?.length) return; setUploading(true); try { for (const f of Array.from(list)) await uploadMtFile('tender', id, f); await load(); } catch (er) { setErr(errMessage(er)); } finally { setUploading(false); } }} />
                {uploading && <div style={{ fontSize: '0.75rem', color: C.muted }}>מעלה…</div>}
              </Card>
            )}
            {canExtend && (
              <Card title="הארכת המועד האחרון">
                <div style={{ fontSize: '0.78rem', color: C.muted, marginBottom: 8 }}>אפשרית פעם אחת, וכשיש פחות מ-{LIMITS.extendAllowedBelowProposals} הצעות. הצעות שהוגשו נשארות בתוקף.</div>
                <Btn small kind="secondary" onClick={() => { setNewDeadline(toLocalInput(new Date(Date.now() + 5 * 86400000).toISOString())); setExtendOpen(true); }}>הארכת מועד</Btn>
              </Card>
            )}
            {isOpen && (
              <Card title="ביטול המיני־מכרז">
                <div style={{ fontSize: '0.78rem', color: C.muted, marginBottom: 8 }}>{t.proposals_count > 0 ? `${t.proposals_count} מציעים כבר הגישו — הם יקבלו הודעת ביטול.` : 'עדיין לא הוגשו הצעות.'}</div>
                <Btn small kind="danger" onClick={() => setCancelOpen(true)}>בטל מיני־מכרז</Btn>
              </Card>
            )}
            {!isOpen && !canExtend && <Card><div style={{ fontSize: '0.84rem', color: C.muted }}>אין פעולות עריכה זמינות בשלב זה.</div></Card>}
          </div>
        )}
      </div>

      {extendOpen && (
        <Modal title="הארכת המועד האחרון" onClose={() => setExtendOpen(false)}
          footer={<><Btn disabled={busy || !newDeadline} onClick={() => run(() => mtFetch(`/${id}/extend`, { method: 'POST', body: { deadline_at: fromLocalInput(newDeadline) } }).then(() => setExtendOpen(false)), 'המועד הוארך')}>אישור</Btn><Btn kind="secondary" onClick={() => setExtendOpen(false)}>ביטול</Btn></>}>
          <Field label="מועד אחרון חדש" hint={`בין ${LIMITS.minDeadlineHours} שעות ל-${LIMITS.maxDeadlineDays} יום מעכשיו. תקופת השאלות תתעדכן ל-24 שעות לפני.`}>
            <Input type="datetime-local" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
          </Field>
        </Modal>
      )}
      {cancelOpen && (
        <Modal title="ביטול המיני־מכרז" onClose={() => setCancelOpen(false)}
          footer={<><Btn kind="danger" disabled={busy} onClick={() => run(() => mtFetch(`/${id}/cancel`, { method: 'POST', body: { reason: cancelReason, note: cancelNote || undefined } }).then(() => setCancelOpen(false)), 'המיני־מכרז בוטל')}>{busy ? 'מבטל…' : 'כן, לבטל'}</Btn><Btn kind="secondary" onClick={() => setCancelOpen(false)}>חזרה</Btn></>}>
          {t.proposals_count > 0 && <Notice kind="warn">{t.proposals_count} מציעים כבר הגישו — הם יקבלו הודעת ביטול.</Notice>}
          <Field label="סיבת הביטול" required>
            <Select value={cancelReason} onChange={(e) => setCancelReason(e.target.value as MtClosedReason)}>{CLOSED_REASONS.filter((r) => r !== 'no_decision').map((r) => <option key={r} value={r}>{CLOSED_REASON_LABEL[r]}</option>)}</Select>
          </Field>
          <Field label="הערה (לא חובה)"><Input value={cancelNote} maxLength={500} onChange={(e) => setCancelNote(e.target.value)} /></Field>
        </Modal>
      )}
    </InternalShell>
  );
}
