'use client';
// /mt/[id] — דף המיני־מכרז. מציע: פרטים, שאלה, ההצעה שלי. מזמין: תצוגה + קיצורים לניהול/השוואה.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import InternalShell from '../../components/InternalShell';
import { PROPOSAL_STATUS_LABEL, errMessage, fmtDateTime, fmtMoney, mtFetch, timeLeft } from '../../lib/mt/client';
import type { MtAttachment, MtItem, MtProposal, MtQuestion, MtRequirement, MtTender } from '../../lib/mt/types';
import TenderDetails, { type ViewerTender } from '../TenderDetails';
import { Badge, Btn, C, Card, Modal, Notice, Row, SignInPrompt, Spinner, Textarea, useNow, useSession } from '../ui';

type Resp =
  | { role: 'buyer'; tender: MtTender; items: MtItem[]; requirements: MtRequirement[]; files: MtAttachment[]; questions: MtQuestion[] }
  | { role: 'bidder'; tender: ViewerTender; items: MtItem[]; requirements: MtRequirement[]; files: MtAttachment[]; questions: MtQuestion[]; myProposal: MtProposal | null };

export default function MtTenderPage() {
  const { id } = useParams<{ id: string }>();
  const { session, ready } = useSession();
  const now = useNow();
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [qBusy, setQBusy] = useState(false);
  const [qMsg, setQMsg] = useState('');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => mtFetch<Resp>(`/${id}`).then(setData).catch((e) => setErr(errMessage(e)));
  useEffect(() => {
    if (!ready || !session) return;
    load();
    mtFetch(`/${id}/view`, { method: 'POST', body: {} }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session, id]);

  async function ask() {
    if (q.trim().length < 5) return;
    setQBusy(true); setQMsg('');
    try {
      await mtFetch(`/${id}/questions`, { method: 'POST', body: { text: q.trim() } });
      setQ(''); setQMsg('השאלה נשלחה למזמין. התשובה תפורסם כהבהרה לכל המציעים.');
    } catch (e) { setQMsg(errMessage(e)); } finally { setQBusy(false); }
  }
  async function withdraw(pid: string) {
    setBusy(true);
    try { await mtFetch(`/proposals/${pid}/withdraw`, { method: 'POST', body: {} }); setWithdrawOpen(false); await load(); }
    catch (e) { setErr(errMessage(e)); } finally { setBusy(false); }
  }

  const title = data?.tender.title || 'מיני־מכרז';
  if (!ready) return <InternalShell title={title}><Spinner /></InternalShell>;
  if (!session) return <InternalShell title="מיני־מכרז"><SignInPrompt next={`/mt/${id}`} /></InternalShell>;
  if (err) return <InternalShell title="מיני־מכרז"><div style={{ padding: 22 }}><Notice kind="error">{err}</Notice><Btn href="/mt/open" kind="secondary">למיני־מכרזים הפתוחים</Btn></div></InternalShell>;
  if (!data) return <InternalShell title={title}><Spinner /></InternalShell>;

  const t = data.tender;
  const isOpen = t.status === 'open' && !!t.deadline_at && new Date(t.deadline_at).getTime() > now;
  const questionsOpen = isOpen && (!t.questions_close_at || new Date(t.questions_close_at).getTime() > now);

  if (data.role === 'buyer') {
    const href = t.status === 'draft' ? `/mt/${id}/edit` : ['open', 'expired'].includes(t.status) ? `/mt/${id}/manage` : `/mt/${id}/compare`;
    return (
      <InternalShell title={title} subtitle="כך המציעים רואים את המיני־מכרז שלכם" action={<Btn href={href}>{t.status === 'draft' ? 'המשך עריכה' : t.status === 'open' ? 'דף הניהול' : 'השוואה ובחירה'}</Btn>}>
        <div style={{ padding: 22, maxWidth: 860 }}>
          <TenderDetails tender={{ ...t, buyer: { anonymous: t.is_anonymous, categories: [], region: t.region, email: session.user.email } }} items={data.items} requirements={data.requirements} files={data.files} questions={data.questions} />
        </div>
      </InternalShell>
    );
  }

  const mine = data.myProposal;
  const action = isOpen
    ? <Btn href={`/mt/${id}/propose`}>{mine ? 'עריכת ההצעה שלי' : 'הגשת הצעה'}</Btn>
    : <Btn href="/mt/open" kind="secondary">מיני־מכרזים פתוחים</Btn>;

  return (
    <InternalShell title={title} subtitle={isOpen ? `פתוח להצעות · ${timeLeft(t.deadline_at)}` : undefined} action={action}>
      <div style={{ padding: 22, display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 560px', minWidth: 0, maxWidth: 860 }}>
          {mine && (
            <Card style={{ marginBottom: 14, borderColor: mine.status === 'won' ? C.green : C.blue }} title="ההצעה שלי"
              action={<Badge fg={mine.status === 'won' ? C.green : mine.status === 'lost' ? C.muted : C.blueDark} bg={mine.status === 'won' ? C.greenPale : mine.status === 'lost' ? C.bg : '#e8f1fb'}>{PROPOSAL_STATUS_LABEL[mine.status]}</Badge>}>
              <Row gap={20} style={{ fontSize: '0.84rem', marginBottom: 10 }}>
                <div><span style={{ color: C.muted }}>סה״כ: </span><b>{fmtMoney(mine.total)}</b> <span style={{ color: C.muted }}>({t.vat_included ? 'כולל' : 'לפני'} מע״מ)</span></div>
                <div><span style={{ color: C.muted }}>עודכנה: </span>{fmtDateTime(mine.last_updated_at)}</div>
                {mine.rank && t.status !== 'open' && <div><span style={{ color: C.muted }}>דירוג לפי מחיר: </span>{mine.rank}</div>}
              </Row>
              {mine.status === 'won' && (
                <Notice kind="success">ההצעה שלכם נבחרה! פרטי הקשר של המזמין: <b>{data.tender.buyer?.email || 'נשלחו במייל'}</b>. משם — ממשיכים ישירות ביניכם.</Notice>
              )}
              {mine.status === 'submitted' && isOpen && (
                <>
                  <Notice>ההצעה חתומה עד {fmtDateTime(t.deadline_at)} — המזמין יראה אותה רק אז. עד המועד אפשר לערוך או למשוך.</Notice>
                  <Row><Btn href={`/mt/${id}/propose`} kind="secondary" small>עריכה</Btn><Btn kind="danger" small onClick={() => setWithdrawOpen(true)}>משיכת ההצעה</Btn></Row>
                </>
              )}
              {mine.status === 'submitted' && !isOpen && t.status === 'evaluating' && <Notice>המועד עבר. המזמין משווה בין ההצעות — נעדכן אתכם עם ההחלטה.</Notice>}
              {mine.status === 'lost' && <Notice>הפעם נבחרה הצעה אחרת. תודה על הזמן שהשקעתם — <Link href="/mt/open">מיני־מכרזים פתוחים נוספים</Link>.</Notice>}
            </Card>
          )}
          {!mine && isOpen && (
            <Card style={{ marginBottom: 14, background: '#e8f1fb', borderColor: C.blue }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.875rem' }}><b>מעוניינים?</b> ההגשה קצרה ומובנית. ההצעה חתומה עד המועד ונחשפת רק למזמין.</div>
                <Btn href={`/mt/${id}/propose`}>הגשת הצעה</Btn>
              </Row>
            </Card>
          )}
          <TenderDetails tender={t} items={data.items} requirements={data.requirements} files={data.files} questions={data.questions} />
        </div>

        <aside style={{ flex: '0 0 300px' }}>
          <Card title="שאלה למזמין">
            {questionsOpen ? (
              <>
                <Textarea value={q} onChange={(e) => setQ(e.target.value)} placeholder="השאלה מוצגת למזמין בלבד; התשובה תפורסם כהבהרה לכל המציעים, ללא זהות השואל." style={{ minHeight: 90, marginBottom: 8 }} maxLength={1500} />
                <Btn small onClick={ask} disabled={qBusy || q.trim().length < 5}>{qBusy ? 'שולח…' : 'שליחת שאלה'}</Btn>
                {qMsg && <div style={{ fontSize: '0.76rem', marginTop: 8, color: C.muted }}>{qMsg}</div>}
                <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: 8 }}>שאלות עד {fmtDateTime(t.questions_close_at)}</div>
              </>
            ) : <div style={{ fontSize: '0.82rem', color: C.muted }}>תקופת השאלות הסתיימה.</div>}
          </Card>
        </aside>
      </div>

      {withdrawOpen && mine && (
        <Modal title="למשוך את ההצעה?" onClose={() => setWithdrawOpen(false)}
          footer={<><Btn kind="danger" onClick={() => withdraw(mine.id)} disabled={busy}>{busy ? 'מושך…' : 'כן, למשוך'}</Btn><Btn kind="secondary" onClick={() => setWithdrawOpen(false)}>ביטול</Btn></>}>
          <div style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>ההצעה תוסר ולא תיכלל בהשוואה. אפשר להגיש הצעה חדשה עד המועד האחרון.</div>
        </Modal>
      )}
    </InternalShell>
  );
}
