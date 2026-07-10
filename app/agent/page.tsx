'use client';
import { useEffect, useState } from 'react';
import InternalShell from '../components/InternalShell';
import { BORDER, DARK } from '../lib/tenderMeta';

type Step = { icon: string; title: string; sub: string; state: 'done' | 'active' | 'pending' };
type Msg = { role: 'agent' | 'user'; text: string };

const STEP_STYLE = {
  done:    { bg: '#e8f1fb', fg: '#1e5aa8', mark: '\u2713' },
  active:  { bg: '#fbf3d8', fg: '#8a6d1f', mark: '\u25CF' },
  pending: { bg: '#eef1f4', fg: '#8a97a3', mark: '\u25CB' },
};

export default function AgentPage() {
  const [scanning, setScanning] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');

  useEffect(() => {
    fetch('/api/agent')
      .then((r) => r.json())
      .then((d) => { setScanning(d.scanning || 0); setSteps(d.steps || []); setMessages(d.messages || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function send() {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: 'user', text }, { role: 'agent', text: 'קיבלתי \u2014 אני מעבד את השאלה על בסיס המכרזים שסרקתי.' }]);
    setInput('');
  }

  return (
    <InternalShell
      title="הסוכן החכם"
      subtitle={loading ? 'טוען\u2026' : '\u25CF פעיל \u00B7 סורק ' + scanning.toLocaleString('he-IL') + ' מכרזים'}
    >
      <div style={{ maxWidth: 760 }}>
        <div style={{ background: '#fff', border: '1px solid ' + BORDER, borderRadius: 14, padding: 18, marginBottom: 18 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: DARK }}>⚙ תהליך העבודה של הסוכן</div>
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
                maxWidth: '80%', fontSize: 13.5, lineHeight: 1.5, padding: '11px 14px',
                background: m.role === 'user' ? '#2b6fc4' : '#f4f6f8',
                color: m.role === 'user' ? '#fff' : DARK,
                borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              }}>{m.text}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', bottom: 0, background: '#eef1f4', paddingTop: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                        placeholder="שאל את הסוכן…"
            style={{ flex: 1, padding: '12px 18px', borderRadius: 999, border: '1px solid ' + BORDER, fontSize: 14, outline: 'none', background: '#fff' }}
          />
          <button onClick={send} aria-label="שלח" style={{ width: 44, height: 44, borderRadius: 999, background: '#2b6fc4', color: '#fff', border: 'none', fontSize: 18, cursor: 'pointer', flex: '0 0 auto' }}↑</button>
        </div>
      </div>
    </InternalShell>
  );
}
