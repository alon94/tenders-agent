'use client';
import { useEffect, useRef, useState } from 'react';
import InternalShell from '../components/InternalShell';
import { BORDER, DARK } from '../lib/tenderMeta';
import { fetchMyProfile, type BusinessProfile } from '../lib/profileApi';

type Step = { icon: string; title: string; sub: string; state: 'done' | 'active' | 'pending' };
type TenderCard = {
  id: string; title: string; publisher: string; deadline: string; url: string; score: number;
};
type Msg = { role: 'agent' | 'user'; text: string; tenders?: TenderCard[] };

const STEP_STYLE = {
  done:    { bg: '#e8f1fb', fg: '#1e5aa8', mark: '✓' },
  active:  { bg: '#fbf3d8', fg: '#8a6d1f', mark: '●' },
  pending: { bg: '#eef1f4', fg: '#8a97a3', mark: '○' },
};

function fmtDate(d: string): string {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return d; }
}

function profileQuery(p: BusinessProfile | null): string {
  if (!p) return '';
  const params = new URLSearchParams();
  if (p.categories?.length) params.set('categories', p.categories.join(','));
  if (p.region) params.set('region', p.region);
  if (p.publisher_type) params.set('publisher_type', p.publisher_type);
  const qs = params.toString();
  return qs ? '?' + qs : '';
}

function scoreColor(score: number): { bg: string; fg: string } {
  if (score >= 10) return { bg: '#e3f4ea', fg: '#1e9e5a' };
  if (score >= 5) return { bg: '#fbf3d8', fg: '#8a6d1f' };
  return { bg: '#e8f1fb', fg: '#1e5aa8' };
}

function TenderList({ tenders }: { tenders: TenderCard[] }) {
  if (!tenders || tenders.length === 0) return null;
  const sorted = [...tenders].sort((a, b) => b.score - a.score);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
      {sorted.map((t) => {
        const sc = scoreColor(t.score);
        return (
          <a
            key={t.id}
            href={t.url || '#'}
            target={t.url ? '_blank' : undefined}
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: '#fff', border: '1px solid ' + BORDER, borderRadius: 10,
              padding: '10px 12px', textDecoration: 'none', color: DARK,
            }}
          >
            <span title="ציון התאמה" style={{
              flex: '0 0 auto', minWidth: 40, textAlign: 'center', padding: '4px 8px',
              borderRadius: 8, background: sc.bg, color: sc.fg, fontSize: 13, fontWeight: 700,
            }}>{t.score}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{t.title}</div>
              <div style={{ fontSize: 11.5, color: '#7a8794', marginTop: 4 }}>
                {t.publisher || '—'}
                {t.deadline ? ' · מועד אחרון: ' + fmtDate(t.deadline) : ''}
                {t.score >= 10 ? ' · התאמה גבוהה' : t.score >= 5 ? ' · התאמה טובה' : ' · התאמה חלקית'}
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

export default function AgentPage() {
  const [scanning, setScanning] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState('');
  const profileRef = useRef<BusinessProfile | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        profileRef.current = await fetchMyProfile().catch(() => null);
        const r = await fetch('/api/agent' + profileQuery(profileRef.current));
        const d = await r.json();
        setScanning(d.scanning || 0);
        setSteps(d.steps || []);
        setMessages(d.messages || []);
      } catch {
        setMessages([{ role: 'agent', text: 'שגיאה בטעינת נתוני הסוכן. נסה לרענן את העמוד.' }]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, thinking]);

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setThinking(true);
    try {
      const p = profileRef.current;
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          profile: p ? { categories: p.categories, region: p.region, publisher_type: p.publisher_type } : undefined,
        }),
      });
      const d = await res.json();
      if (d?.reply?.text) {
        setMessages((m) => [...m, { role: 'agent', text: d.reply.text, tenders: d.reply.tenders || [] }]);
      } else {
        setMessages((m) => [...m, { role: 'agent', text: 'משהו השתבש בעיבוד השאלה. נסה שוב.' }]);
      }
    } catch {
      setMessages((m) => [...m, { role: 'agent', text: 'שגיאת תקשורת — נסה שוב בעוד רגע.' }]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <InternalShell
      title="הסוכן החכם"
      subtitle={loading ? 'טוען…' : '● פעיל · סורק ' + scanning.toLocaleString('he-IL') + ' מכרזים'}
    >
      <div style={{ maxWidth: 760 }}>
        <div style={{ background: '#fff', border: '1px solid ' + BORDER, borderRadius: 14, padding: 18, marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: DARK }}>⚙ תהליך העבודה של הסוכן</div>
          {loading && <div style={{ fontSize: 13, color: '#7a8794' }}>סורק מכרזים ומחשב התאמות…</div>}
          {steps.map((s, i) => {
            const st = STEP_STYLE[s.state];
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: i ? '1px solid #eef1f4' : 'none' }}>
                <span style={{ width: 26, height: 26, borderRadius: 999, background: st.bg, color: st.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flex: '0 0 auto' }}>{st.mark}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: '#7a8794' }}>{s.sub}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-start' : 'flex-end' }}>
              <div style={{
                maxWidth: '85%', fontSize: 13.5, lineHeight: 1.5, padding: '11px 14px',
                background: m.role === 'user' ? '#2b6fc4' : '#f4f6f8',
                color: m.role === 'user' ? '#fff' : DARK,
                borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              }}>
                {m.text}
                {m.tenders && <TenderList tenders={m.tenders} />}
              </div>
            </div>
          ))}
          {thinking && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 13.5, padding: '11px 14px', background: '#f4f6f8', color: '#7a8794', borderRadius: '12px 12px 12px 4px' }}>
                מנתח את המכרזים…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', bottom: 0, background: '#eef1f4', paddingTop: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder='שאל את הסוכן — למשל "מה נסגר השבוע?"'
            disabled={loading}
            style={{ flex: 1, padding: '12px 18px', borderRadius: 999, border: '1px solid ' + BORDER, fontSize: 14, outline: 'none', background: '#fff' }}
          />
          <button onClick={send} aria-label="שלח" disabled={thinking} style={{ width: 44, height: 44, borderRadius: 999, background: thinking ? '#9db8d8' : '#2b6fc4', color: '#fff', border: 'none', fontSize: 18, cursor: thinking ? 'default' : 'pointer', flex: '0 0 auto' }}>↑</button>
        </div>
      </div>
    </InternalShell>
  );
}
