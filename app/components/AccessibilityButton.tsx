'use client';

import { useCallback, useEffect, useState } from 'react';

// כפתור נגישות בסרגל הצד (דסקטופ). פותח/סוגר את תפריט NagishLi שנטען
// ב-NagishLiLoader — במקום הסמל הצף שהתוסף מצייר בפינה. ה-handler של
// התוסף מקבל רק קליק עכבר אמיתי (which===1), לכן משדרים MouseEvent עם
// button=0 (jQuery גוזר ממנו which=1). אם התוסף לא נטען (ללא קבצים, ללא
// רשת) הכפתור מוביל להצהרת הנגישות — כך שאין מצב של כפתור שלא עושה כלום.
const STRIP = 'nagishli#NagishLiTag > #NagishLiBar > #NagishLiBarStrip';

export default function AccessibilityButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);

  // סנכרון aria-expanded עם מצב התוסף (נסגר גם דרך הסרגל של התוסף עצמו)
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const strip = document.querySelector(STRIP);
      setOpen(!!strip && strip.classList.contains('open'));
      raf = window.setTimeout(tick, 800);
    };
    tick();
    return () => window.clearTimeout(raf);
  }, []);

  const toggle = useCallback(() => {
    const strip = document.querySelector<HTMLElement>(STRIP);
    if (!strip) { window.location.href = '/accessibility'; return; }
    strip.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    setOpen(!strip.classList.contains('open'));
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      aria-controls="NagishLiBar"
      aria-label="תפריט נגישות"
      style={{
        display: 'flex', alignItems: 'center', gap: 11, width: '100%',
        padding: compact ? '9px 12px' : '11px 12px', borderRadius: 9,
        border: '1px solid #e2e7ec', background: open ? '#e8f1fb' : '#fff',
        color: open ? '#1e5aa8' : '#5b6b7a', fontSize: '0.90625rem', fontWeight: 600,
        fontFamily: 'inherit', cursor: 'pointer', textAlign: 'start', marginBottom: 10,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '1rem' }}>♿</span>
      <span style={{ flex: 1 }}>נגישות</span>
      <span aria-hidden="true" style={{ fontSize: '0.6875rem', opacity: .7 }}>{open ? '▲' : '▼'}</span>
    </button>
  );
}
