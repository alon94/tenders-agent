'use client';

import { useEffect } from 'react';

// NagishLi v2.3 תלוי ב-jQuery (שאינו בשימוש בשאר האתר) ומאתחל את עצמו רק
// באירוע load של החלון — שכבר עבר עד שסקריפט lazy נטען. הרצף כאן: jQuery
// מ-CDN → nagishli.js המקומי → קריאה מפורשת ל-initNagishLi, עם שמירה מפני
// אתחול כפול. כשל בכל שלב נבלע — האתר לא תלוי בתוסף.
declare global {
  interface Window { initNagishLi?: () => void; jQuery?: unknown; NagishLiStatus?: unknown }
}

// מקומי (public/vendor) — ה-CSP של האתר מתיר סקריפטים מ-'self' בלבד
const JQUERY_SRC = '/vendor/jquery.min.js';

function addScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('failed: ' + src));
    document.body.appendChild(s);
  });
}

export default function NagishLiLoader() {
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        if (!window.jQuery) await addScript(JQUERY_SRC);
        if (cancelled) return;
        if (!window.initNagishLi) await addScript('/nagishli.js');
        if (cancelled) return;
        // אתחול רק אם התוסף עוד לא צייר את עצמו
        if (!document.getElementById('NagishLiBarOpener') && !document.querySelector('[id^="NagishLi"]')) {
          window.initNagishLi?.();
        }
      } catch { /* התוסף אופציונלי — בלי קבצים או בלי רשת האתר ממשיך כרגיל */ }
    }, 1500); // אחרי טעינת התוכן — לא מתחרה על רוחב הפס של העמוד עצמו
    return () => { cancelled = true; clearTimeout(t); };
  }, []);
  return null;
}
