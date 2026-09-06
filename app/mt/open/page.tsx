'use client';
// /mt/open — מיני־מכרזים פתוחים להגשה, עם סינון ומיון «הכי מתאים לי»
import { useEffect, useState } from 'react';
import InternalShell from '../../components/InternalShell';
import { CATEGORY_OPTIONS, DOMAINS } from '../../lib/domains';
import { ENGAGEMENT_LABEL, errMessage, fmtBudget, fmtDateTime, mtFetch, REGIONS, regionLabel, timeLeft } from '../../lib/mt/client';
import type { MtEngagementType } from '../../lib/mt/types';
import { Badge, Btn, C, Card, Notice, Row, Select, SignInPrompt, Spinner, useSession } from '../ui';

interface OpenRow {
  id: string; title: string; category_ids: string[]; region: string | null; city: string | null; is_remote: boolean;
  budget_min: number | null; budget_max: number | null; deadline_at: string | null; proposals_count: number;
  published_at: string | null; engagement_type: MtEngagementType | null; is_anonymous: boolean; is_new: boolean; match_score: number;
}
const catLabel = (id: string) => DOMAINS.find((d) => d.id === id)?.label || id;

export default function MtOpen() {
  const { session, ready } = useSession();
  const [result, setResult] = useState<{ q: string; rows: OpenRow[] } | null>(null);
  const [err, setErr] = useState('');
  const [cat, setCat] = useState('');
  const [region, setRegion] = useState('');
  const [remote, setRemote] = useState(false);
  const [sort, setSort] = useState<'match' | 'deadline' | 'newest'>('match');

  useEffect(() => {
    if (!ready || !session) return;
    const q = new URLSearchParams();
    if (cat) q.set('category', cat);
    if (region) q.set('region', region);
    if (remote) q.set('remote', '1');
    q.set('sort', sort === 'newest' ? 'new' : sort);
    const qs = q.toString();
    mtFetch<{ tenders: OpenRow[] }>(`/open?${qs}`).then((r) => setResult({ q: qs, rows: r.tenders })).catch((e) => setErr(errMessage(e)));
  }, [ready, session, cat, region, remote, sort]);
  const currentQ = (() => { const q = new URLSearchParams(); if (cat) q.set('category', cat); if (region) q.set('region', region); if (remote) q.set('remote', '1'); q.set('sort', sort === 'newest' ? 'new' : sort); return q.toString(); })();
  const rows = result && result.q === currentQ ? result.rows : null;

  return (
    <InternalShell title="מיני־מכרזים פתוחים" subtitle="הזדמנויות מעסקים שמחפשים ספק — הגישו הצעה חתומה עד המועד" action={<Btn href="/mt" kind="secondary">המיני־מכרזים שלי</Btn>}>
      <div style={{ padding: 22, maxWidth: 1100 }}>
        {!ready ? <Spinner /> : !session ? <SignInPrompt next="/mt/open" /> : (
          <>
            <Card style={{ marginBottom: 14 }}>
              <Row gap={10}>
                <Select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 200 }} aria-label="תחום">
                  <option value="">כל התחומים</option>
                  {CATEGORY_OPTIONS.filter((o) => o.value !== 'other').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
                <Select value={region} onChange={(e) => setRegion(e.target.value)} style={{ width: 160 }} aria-label="אזור">
                  <option value="">כל האזורים</option>
                  {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </Select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83rem' }}>
                  <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} /> כולל «מרחוק»
                </label>
                <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={{ width: 170 }} aria-label="מיון">
                  <option value="match">הכי מתאים לי</option>
                  <option value="deadline">לפי מועד אחרון</option>
                  <option value="newest">החדשים ביותר</option>
                </Select>
              </Row>
            </Card>
            {err ? <Notice kind="error">{err}</Notice> : !rows ? <Spinner /> : rows.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: 36, color: C.muted }}>אין כרגע מיני־מכרזים פתוחים שתואמים לסינון. כדאי לוודא שהתחום והאזור בפרופיל העסקי מעודכנים — כך תקבלו התראה על כל הזדמנות חדשה.</Card>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {rows.map((t) => (
                  <a key={t.id} href={`/mt/${t.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Card style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                        <Row gap={8} style={{ marginBottom: 4 }}>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{t.title}</span>
                          {t.is_new && <Badge fg={C.green} bg={C.greenPale}>חדש</Badge>}
                          {t.match_score >= 2 && <Badge fg={C.blueDark} bg="#e8f1fb">בתחום שלך</Badge>}
                        </Row>
                        <div style={{ fontSize: '0.78rem', color: C.muted }}>
                          {t.category_ids.map(catLabel).join(' · ')}
                          {t.engagement_type && ` · ${ENGAGEMENT_LABEL[t.engagement_type]}`}
                          {' · '}{t.is_remote ? 'מרחוק' : [regionLabel(t.region), t.city].filter(Boolean).join(', ')}
                          {t.is_anonymous && ' · מזמין אנונימי'}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.8rem', minWidth: 150 }}>
                        <div><span style={{ color: C.muted }}>תקציב:</span> {fmtBudget(t.budget_min, t.budget_max)}</div>
                        <div><span style={{ color: C.muted }}>הצעות:</span> {t.proposals_count}</div>
                      </div>
                      <div style={{ fontSize: '0.8rem', minWidth: 170 }}>
                        <div style={{ color: C.amber, fontWeight: 700 }}>{timeLeft(t.deadline_at)}</div>
                        <div style={{ color: C.muted }}>{fmtDateTime(t.deadline_at)}</div>
                      </div>
                    </Card>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </InternalShell>
  );
}
