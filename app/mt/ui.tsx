'use client';
// ============================================================
// מיני־מכרז — רכיבי UI משותפים לכל דפי /mt. אותה פלטה כמו InternalShell.
// ============================================================
import { useEffect, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { getSession, AUTH_EVENT, type AuthSession } from '../lib/authClient';
import { STATUS_COLOR, STATUS_LABEL } from '../lib/mt/client';
import type { MtTenderStatus } from '../lib/mt/types';

export const C = {
  dark: '#1a2330', blue: '#2b6fc4', blueDark: '#1e5aa8', border: '#e6eaee', muted: '#5f6c7a', bg: '#eef1f4',
  green: '#0D9488', greenPale: '#CCFBF1', amber: '#B45309', amberPale: '#FEF3C7', red: '#B91C1C', redPale: '#FEE2E2',
};

export function Card({ children, style, title, action }: { children: ReactNode; style?: CSSProperties; title?: ReactNode; action?: ReactNode }) {
  return (
    <section style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, ...style }}>
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          {title && <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: C.dark }}>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Btn({ children, onClick, href, kind = 'primary', disabled, small, type = 'button', style, title }: {
  children: ReactNode; onClick?: () => void; href?: string; kind?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean; small?: boolean; type?: 'button' | 'submit'; style?: CSSProperties; title?: string;
}) {
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: small ? '6px 12px' : '10px 18px', borderRadius: 9, fontSize: small ? '0.78rem' : '0.875rem', fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer', textDecoration: 'none', fontFamily: 'inherit', opacity: disabled ? 0.55 : 1,
    border: '1px solid transparent', lineHeight: 1.2, whiteSpace: 'nowrap',
    ...(kind === 'primary' ? { background: C.blue, color: '#fff' }
      : kind === 'danger' ? { background: '#fff', color: C.red, borderColor: '#f3c4c4' }
      : kind === 'ghost' ? { background: 'transparent', color: C.blueDark }
      : { background: '#fff', color: C.dark, borderColor: '#d6dde4' }),
    ...style,
  };
  if (href && !disabled) return <a href={href} style={base} title={title}>{children}</a>;
  return <button type={type} onClick={onClick} disabled={disabled} style={base} title={title}>{children}</button>;
}

export function Badge({ children, fg = C.muted, bg = C.bg }: { children: ReactNode; fg?: string; bg?: string }) {
  return <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, color: fg, background: bg, whiteSpace: 'nowrap' }}>{children}</span>;
}
export function StatusBadge({ status }: { status: MtTenderStatus }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.draft;
  return <Badge fg={c.fg} bg={c.bg}>{STATUS_LABEL[status] || status}</Badge>;
}

export function Field({ label, hint, required, children, error }: { label: ReactNode; hint?: ReactNode; required?: boolean; children: ReactNode; error?: string | null }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.dark, marginBottom: 5 }}>
        {label}{required && <span style={{ color: C.red }}> *</span>}
      </div>
      {children}
      {error ? <div style={{ fontSize: '0.74rem', color: C.red, marginTop: 4 }}>{error}</div>
        : hint ? <div style={{ fontSize: '0.74rem', color: C.muted, marginTop: 4 }}>{hint}</div> : null}
    </label>
  );
}
export const inputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: `1px solid #d6dde4`,
  fontSize: '0.875rem', fontFamily: 'inherit', color: C.dark, background: '#fff', outline: 'none',
};
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputStyle, minHeight: 110, resize: 'vertical', lineHeight: 1.5, ...(props.style || {}) }} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
export function Radio<T extends string>({ value, options, onChange, name }: { value: T | null; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void; name: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 9, cursor: 'pointer',
            border: `1.5px solid ${on ? C.blue : '#d6dde4'}`, background: on ? '#e8f1fb' : '#fff', fontSize: '0.83rem', fontWeight: on ? 700 : 500 }}>
            <input type="radio" name={name} checked={on} onChange={() => onChange(o.value)} style={{ margin: 0 }} />
            <span>{o.label}{o.hint && <span style={{ color: C.muted, fontWeight: 400 }}> · {o.hint}</span>}</span>
          </label>
        );
      })}
    </div>
  );
}
export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
      <span onClick={(e) => { e.preventDefault(); onChange(!checked); }} role="switch" aria-checked={checked}
        style={{ flex: '0 0 38px', height: 22, borderRadius: 999, background: checked ? C.blue : '#cfd7df', position: 'relative', transition: 'background .15s', marginTop: 1 }}>
        <span style={{ position: 'absolute', top: 2, insetInlineStart: checked ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .15s' }} />
      </span>
      <span>
        <div style={{ fontSize: '0.83rem', fontWeight: 700, color: C.dark }}>{label}</div>
        {hint && <div style={{ fontSize: '0.74rem', color: C.muted }}>{hint}</div>}
      </span>
    </label>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'error' | 'success'; children: ReactNode }) {
  const c = kind === 'error' ? { fg: C.red, bg: C.redPale } : kind === 'warn' ? { fg: C.amber, bg: C.amberPale }
    : kind === 'success' ? { fg: C.green, bg: C.greenPale } : { fg: C.blueDark, bg: '#e8f1fb' };
  return <div role={kind === 'error' ? 'alert' : undefined} style={{ padding: '10px 14px', borderRadius: 10, background: c.bg, color: c.fg, fontSize: '0.83rem', lineHeight: 1.5, marginBottom: 12 }}>{children}</div>;
}

export function Spinner({ label = 'טוען…' }: { label?: string }) {
  return <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: '0.875rem' }}>{label}</div>;
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', minWidth: 120 }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: C.dark, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.74rem', color: C.muted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

export function Modal({ title, children, onClose, footer }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,48,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, width: 'min(560px, 100%)', maxHeight: '90vh', overflow: 'auto', padding: 20, direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="סגירה" style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: C.muted }}>✕</button>
        </div>
        {children}
        {footer && <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-start', marginTop: 16 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Row({ children, gap = 10, wrap = true, style }: { children: ReactNode; gap?: number; wrap?: boolean; style?: CSSProperties }) {
  return <div style={{ display: 'flex', gap, flexWrap: wrap ? 'wrap' : 'nowrap', alignItems: 'center', ...style }}>{children}</div>;
}

export function KV({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: `1px dashed ${C.border}`, fontSize: '0.84rem' }}>
      <div style={{ flex: '0 0 150px', color: C.muted }}>{k}</div>
      <div style={{ flex: 1, color: C.dark }}>{v}</div>
    </div>
  );
}

/** מצב התחברות בצד הלקוח (external store: localStorage + AUTH_EVENT) + מסך «נדרשת התחברות» */
let sessionCache: { raw: string | null; value: AuthSession | null } = { raw: null, value: null };
function sessionSnapshot(): AuthSession | null {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem('tenders_agent_session'); } catch { raw = null; }
  if (raw !== sessionCache.raw) sessionCache = { raw, value: raw ? getSession() : null };
  return sessionCache.value;
}
function subscribeSession(cb: () => void) {
  window.addEventListener(AUTH_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => { window.removeEventListener(AUTH_EVENT, cb); window.removeEventListener('storage', cb); };
}
const READY = { ready: true };
const NOT_READY = { ready: false };
export function useSession(): { session: AuthSession | null; ready: boolean } {
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot, () => null);
  const { ready } = useSyncExternalStore(subscribeSession, () => READY, () => NOT_READY);
  return { session, ready };
}

/** «עכשיו» כ-external store שמתעדכן כל 30 שניות — כדי לא לקרוא Date.now() בזמן render */
let nowValue = 0;
const nowListeners = new Set<() => void>();
let nowTimer: ReturnType<typeof setInterval> | null = null;
function subscribeNow(cb: () => void) {
  nowListeners.add(cb);
  if (!nowTimer) { nowValue = Date.now(); nowTimer = setInterval(() => { nowValue = Date.now(); nowListeners.forEach((l) => l()); }, 30_000); }
  return () => { nowListeners.delete(cb); if (!nowListeners.size && nowTimer) { clearInterval(nowTimer); nowTimer = null; } };
}
export function useNow(): number {
  return useSyncExternalStore(subscribeNow, () => nowValue || (nowValue = Date.now()), () => 0);
}
export function SignInPrompt({ next }: { next?: string }) {
  const q = next ? `?next=${encodeURIComponent(next)}` : '';
  return (
    <Card style={{ maxWidth: 520, margin: '30px auto', textAlign: 'center' }}>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 6 }}>נדרשת התחברות</div>
      <div style={{ color: C.muted, fontSize: '0.85rem', marginBottom: 16 }}>מיני־מכרזים זמינים למשתמשים רשומים בלבד.</div>
      <Row style={{ justifyContent: 'center' }}>
        <Btn href={`/signin${q}`}>התחברות</Btn>
        <Btn href={`/signup${q}`} kind="secondary">הרשמה</Btn>
      </Row>
    </Card>
  );
}
