'use client';
// /mt/i/[token] — קישור הזמנה אישי / קישור ציבורי. מידע חלקי + רישום מקוצר (OTP) למציע חיצוני.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import InternalShell from '../../../components/InternalShell';
import { setSessionFromTokens } from '../../../lib/authClient';
import { errMessage, mtFetch, timeLeft } from '../../../lib/mt/client';
import type { MtItem, MtQuestion, MtRequirement } from '../../../lib/mt/types';
import TenderDetails, { buyerLabel, type ViewerTender } from '../../TenderDetails';
import { Btn, C, Card, Field, Input, Notice, Row, Spinner, useNow, useSession } from '../../ui';

type Resp = {
  tender: ViewerTender; items: MtItem[]; requirements: MtRequirement[]; questions: MtQuestion[];
  invitation: { id: string; kind: 'direct' | 'public_link'; name: string | null; email: string | null; registered: boolean } | null;
  invite_token: string;
};

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { session, ready } = useSession();
  const now = useNow();
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState('');
  // רישום מקוצר
  const [biz, setBiz] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'form' | 'code' | 'done'>('form');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [smsUnavailable, setSmsUnavailable] = useState(false);

  useEffect(() => {
    mtFetch<Resp>(`/public/${token}`, { auth: false })
      .then((r) => { setData(r); if (r.invitation?.name) setContact(r.invitation.name); if (r.invitation?.email) setEmail(r.invitation.email); })
      .catch((e) => setErr(errMessage(e)));
  }, [token]);

  async function sendCode() {
    setBusy(true); setMsg('');
    try {
      const r = await mtFetch<{ ok: boolean }>('/otp/send', { method: 'POST', body: { phone }, auth: false });
      if (!r.ok) { setSmsUnavailable(true); return; }
      setStage('code'); setMsg('שלחנו קוד בן 6 ספרות ב-SMS. תקף ל-10 דקות.');
    } catch (e) { setMsg(errMessage(e)); } finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true); setMsg('');
    try {
      const r = await mtFetch<{ created: boolean; session: { access_token: string; refresh_token: string; expires_in: number; user: { id: string; email: string } } }>(
        '/otp/verify', { method: 'POST', body: { phone, code, business_name: biz, contact_name: contact, email: email || undefined }, auth: false });
      setSessionFromTokens(r.session);
      setStage('done');
      window.location.href = `/mt/${data!.tender.id}/propose?invite=${token}`;
    } catch (e) { setMsg(errMessage(e)); } finally { setBusy(false); }
  }

  const title = data?.tender.title || 'הזמנה להגיש הצעה';
  if (err) return <InternalShell title="הזמנה להגיש הצעה"><div style={{ padding: 22 }}><Notice kind="error">{err}</Notice><Btn href="/" kind="secondary">לדף הבית</Btn></div></InternalShell>;
  if (!data || !ready) return <InternalShell title={title}><Spinner /></InternalShell>;

  const t = data.tender;
  const isOpen = t.status === 'open' && !!t.deadline_at && new Date(t.deadline_at).getTime() > now;
  const proposeHref = `/mt/${t.id}/propose?invite=${token}`;
  const next = encodeURIComponent(`/mt/i/${token}`);

  return (
    <InternalShell title={title} subtitle={data.invitation?.kind === 'direct' ? `${buyerLabel(t)} הזמין אתכם אישית להגיש הצעה` : `הזמנה להגיש הצעת מחיר · ${timeLeft(t.deadline_at)}`}
      action={session && isOpen ? <Btn href={proposeHref}>הגשת הצעה</Btn> : undefined}>
      <div style={{ padding: 22, display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 520px', minWidth: 0, maxWidth: 800 }}>
          <TenderDetails tender={t} items={data.items} requirements={data.requirements} questions={data.questions} />
        </div>
        <aside style={{ flex: '0 0 320px', position: 'sticky', top: 16 }}>
          {!isOpen ? (
            <Card><Notice kind="warn">המיני־מכרז כבר אינו פתוח להגשות.</Notice></Card>
          ) : session ? (
            <Card title="מוכנים להגיש?">
              <div style={{ fontSize: '0.83rem', color: C.muted, lineHeight: 1.6, marginBottom: 12 }}>אתם מחוברים כ-{session.user.email}. ההגשה קצרה ומובנית; ההצעה חתומה עד {timeLeft(t.deadline_at)}.</div>
              <Row><Btn href={proposeHref}>הגשת הצעה</Btn><Btn href={`/mt/${t.id}`} kind="secondary">לדף המלא</Btn></Row>
            </Card>
          ) : (
            <Card title="להגשת הצעה — הרשמה קצרה">
              {stage === 'form' && (
                <>
                  <div style={{ fontSize: '0.8rem', color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>4 שדות ואימות קוד ב-SMS. אפשר להגיש מיד; השלמת הפרופיל — אחר כך.</div>
                  <Field label="שם העסק" required><Input value={biz} onChange={(e) => setBiz(e.target.value)} /></Field>
                  <Field label="שם איש קשר" required><Input value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
                  <Field label="מייל" required><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                  <Field label="טלפון נייד" required hint="לאימות בקוד SMS"><Input type="tel" value={phone} placeholder="05X-XXXXXXX" onChange={(e) => setPhone(e.target.value)} /></Field>
                  {smsUnavailable ? (
                    <Notice kind="warn">אימות ב-SMS אינו זמין כרגע. אפשר להירשם עם מייל וסיסמה ולחזור לקישור הזה.
                      <div style={{ marginTop: 8 }}><Btn href={`/signup?next=${next}`} small>הרשמה עם מייל</Btn></div></Notice>
                  ) : (
                    <Btn onClick={sendCode} disabled={busy || !biz || !contact || !email || phone.replace(/\D/g, '').length < 9} style={{ width: '100%' }}>{busy ? 'שולח…' : 'שליחת קוד אימות'}</Btn>
                  )}
                </>
              )}
              {stage === 'code' && (
                <>
                  <Field label="קוד האימות" required hint={`נשלח ל-${phone}`}><Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} style={{ letterSpacing: 6, fontSize: '1.2rem', textAlign: 'center' }} /></Field>
                  <Row><Btn onClick={verify} disabled={busy || code.length !== 6}>{busy ? 'מאמת…' : 'אימות והמשך להגשה'}</Btn><Btn kind="ghost" small onClick={() => setStage('form')}>שינוי מספר</Btn></Row>
                </>
              )}
              {stage === 'done' && <Notice kind="success">מעבירים אתכם לטופס ההצעה…</Notice>}
              {msg && <div style={{ fontSize: '0.78rem', marginTop: 10, color: C.muted }}>{msg}</div>}
              <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${C.border}`, fontSize: '0.78rem', color: C.muted }}>
                כבר רשומים? <a href={`/signin?next=${next}`}>התחברות</a>
              </div>
            </Card>
          )}
        </aside>
      </div>
    </InternalShell>
  );
}
