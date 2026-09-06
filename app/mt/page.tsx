'use client';
// /mt — «מיני־מכרזים שלי» (כמזמין) + «ההצעות שלי» (כמציע)
import { useEffect, useState } from 'react';
import InternalShell from '../components/InternalShell';
import { errMessage, fmtDateTime, mtFetch, PROPOSAL_STATUS_LABEL, STATUS_LABEL, timeLeft, fmtMoney } from '../lib/mt/client';
import type { MtProposal, MtTender, MtTenderStatus } from '../lib/mt/types';
import { Badge, Btn, C, Card, Notice, Row, SignInPrompt, Spinner, StatusBadge, useSession } from './ui';

type Mine = Pick<MtTender, 'id' | 'status' | 'title' | 'category_ids' | 'deadline_at' | 'proposals_count' | 'views_count' | 'published_at' | 'closed_at' | 'created_at' | 'updated_at'>;
type MyProposal = Pick<MtProposal, 'id' | 'tender_id' | 'status' | 'total' | 'rank' | 'last_updated_at' | 'created_at'> & {
  mt_tenders: Pick<MtTender, 'id' | 'title' | 'status' | 'deadline_at'> | null;
};

const ACTIVE: MtTenderStatus[] = ['draft', 'open', 'evaluating'];

function buyerHref(t: Mine): string {
  if (t.status === 'draft') return `/mt/${t.id}/edit`;
  if (t.status === 'open' || t.status === 'expired') return `/mt/${t.id}/manage`;
  return `/mt/${t.id}/compare`;
}

export default function MtHome() {
  const { session, ready } = useSession();
  const [tabChoice, setTab] = useState<'mine' | 'proposals' | null>(null);
  const [data, setData] = useState<{ mine: Mine[]; proposals: MyProposal[] } | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!ready || !session) return;
    mtFetch<{ mine: Mine[]; proposals: MyProposal[] }>('/').then(setData).catch((e) => setErr(errMessage(e)));
  }, [ready, session]);


  const tab: 'mine' | 'proposals' = tabChoice ?? (data && !data.mine.length && data.proposals.length ? 'proposals' : 'mine');

  const action = (
    <Row>
      <Btn href="/mt/open" kind="secondary">מיני־מכרזים פתוחים</Btn>
      <Btn href="/mt/new">+ פרסם מיני־מכרז</Btn>
    </Row>
  );

  return (
    <InternalShell title="מיני־מכרזים" subtitle="קבלו הצעות מחיר מספקים תוך ימים — חתומות עד המועד האחרון" action={action}>
      <div style={{ padding: 22, maxWidth: 1100 }}>
        {!ready ? <Spinner /> : !session ? <SignInPrompt next="/mt" /> : err ? <Notice kind="error">{err}</Notice> : !data ? <Spinner /> : (
          <>
            <Row style={{ marginBottom: 16, borderBottom: `1px solid ${C.border}` }} gap={0}>
              {(['mine', 'proposals'] as const).map((k) => (
                <button key={k} type="button" onClick={() => setTab(k)}
                  style={{ padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem',
                    fontWeight: tab === k ? 800 : 600, color: tab === k ? C.blueDark : C.muted, borderBottom: tab === k ? `3px solid ${C.blue}` : '3px solid transparent' }}>
                  {k === 'mine' ? `המיני־מכרזים שלי (${data.mine.length})` : `ההצעות שלי (${data.proposals.length})`}
                </button>
              ))}
            </Row>

            {tab === 'mine' && (
              data.mine.length === 0 ? (
                <Card style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 6 }}>צריכים ספק? פרסמו מיני־מכרז</div>
                  <div style={{ color: C.muted, fontSize: '0.875rem', marginBottom: 18, lineHeight: 1.6 }}>
                    מתארים מה צריך, מגדירים מועד אחרון, ומקבלים הצעות מחיר מובנות מעסקים בתחום.<br />
                    ההצעות חתומות עד המועד — נפתחות יחד, להשוואה הוגנת.
                  </div>
                  <Btn href="/mt/new">התחלת מיני־מכרז ראשון</Btn>
                </Card>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {data.mine.map((t) => (
                    <a key={t.id} href={buyerHref(t)} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <Card style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 4 }}>{t.title || <span style={{ color: C.muted }}>ללא כותרת</span>}</div>
                          <Row gap={8}>
                            <StatusBadge status={t.status} />
                            {t.status === 'open' && t.deadline_at && <span style={{ fontSize: '0.76rem', color: C.amber, fontWeight: 700 }}>{timeLeft(t.deadline_at)}</span>}
                            {t.deadline_at && <span style={{ fontSize: '0.76rem', color: C.muted }}>מועד אחרון: {fmtDateTime(t.deadline_at)}</span>}
                          </Row>
                        </div>
                        {t.status !== 'draft' && (
                          <Row gap={18}>
                            <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{t.proposals_count}</div><div style={{ fontSize: '0.7rem', color: C.muted }}>הצעות</div></div>
                            <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{t.views_count}</div><div style={{ fontSize: '0.7rem', color: C.muted }}>צפיות</div></div>
                          </Row>
                        )}
                        <span style={{ color: C.blueDark, fontWeight: 700, fontSize: '0.8rem' }}>
                          {t.status === 'draft' ? 'המשך עריכה ←' : t.status === 'evaluating' ? 'השוואה ובחירה ←' : 'ניהול ←'}
                        </span>
                      </Card>
                    </a>
                  ))}
                  <div style={{ fontSize: '0.74rem', color: C.muted }}>
                    פעילים כרגע: {data.mine.filter((t) => ACTIVE.includes(t.status)).length} מתוך 3 מותרים.
                  </div>
                </div>
              )
            )}

            {tab === 'proposals' && (
              data.proposals.length === 0 ? (
                <Card style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 6 }}>עדיין לא הגשתם הצעות</div>
                  <div style={{ color: C.muted, fontSize: '0.875rem', marginBottom: 18 }}>מיני־מכרזים פתוחים בתחום שלכם מחכים להצעה.</div>
                  <Btn href="/mt/open">למיני־מכרזים הפתוחים</Btn>
                </Card>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {data.proposals.map((p) => {
                    const t = p.mt_tenders;
                    const sealed = t?.status === 'open';
                    return (
                      <a key={p.id} href={`/mt/${p.tender_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <Card style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 260px' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 4 }}>{t?.title || 'מיני־מכרז'}</div>
                            <Row gap={8}>
                              <Badge fg={p.status === 'won' ? C.green : p.status === 'lost' ? C.muted : C.blueDark} bg={p.status === 'won' ? C.greenPale : p.status === 'lost' ? C.bg : '#e8f1fb'}>
                                {PROPOSAL_STATUS_LABEL[p.status]}
                              </Badge>
                              {t && <span style={{ fontSize: '0.76rem', color: C.muted }}>{STATUS_LABEL[t.status]}</span>}
                              {sealed && t?.deadline_at && <span style={{ fontSize: '0.76rem', color: C.amber, fontWeight: 700 }}>{timeLeft(t.deadline_at)}</span>}
                              {p.rank && t?.status !== 'open' && <span style={{ fontSize: '0.76rem', color: C.muted }}>דירוג לפי מחיר: {p.rank}</span>}
                            </Row>
                          </div>
                          <div style={{ fontWeight: 800 }}>{fmtMoney(p.total)}</div>
                          <span style={{ color: C.blueDark, fontWeight: 700, fontSize: '0.8rem' }}>{sealed ? 'עריכה / משיכה ←' : 'פרטים ←'}</span>
                        </Card>
                      </a>
                    );
                  })}
                </div>
              )
            )}
          </>
        )}
      </div>
    </InternalShell>
  );
}
