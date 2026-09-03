'use client';

import { useEffect } from 'react';

// NagishLi v2.3 תלוי ב-jQuery (שאינו בשימוש בשאר האתר) ומאתחל את עצמו רק
// באירוע load של החלון — שכבר עבר עד שסקריפט lazy נטען. הרצף כאן: jQuery
// מ-CDN → nagishli.js המקומי → קריאה מפורשת ל-initNagishLi, עם שמירה מפני
// אתחול כפול. כשל בכל שלב נבלע — האתר לא תלוי בתוסף.
declare global {
  interface Window { initNagishLi?: () => void; jQuery?: unknown; NagishLiStatus?: unknown; nl_pos?: string; nl_link?: string }
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
        // הגדרות התוסף (נקראות כגלובלים בעת האתחול): פינה ימנית-תחתונה —
        // צמוד לסרגל הצד שבו יושב כפתור הנגישות (AccessibilityButton), וקישור
        // להצהרת הנגישות שמנוהלת באדמין.
        window.nl_pos = window.nl_pos || 'BR';
        window.nl_link = window.nl_link || '/accessibility';
        if (!window.jQuery) await addScript(JQUERY_SRC);
        if (cancelled) return;
        // QA 31.08.2026: nagishli.js מאתחל את עצמו בסוף הקובץ כש-jQuery כבר
        // קיים (וכאן jQuery תמיד נטען שלב קודם), ולעיתים באיחור — הקריאה
        // המפורשת שהייתה כאן רצה בנוסף לאתחול העצמי וציירה את הסרגל פעמיים.
        if (!window.initNagishLi) {
          await addScript('/nagishli.js'); // הסקריפט מאתחל את עצמו בסופו
        } else if (cancelled === false && !document.querySelector('nagishli#NagishLiTag')) {
          window.initNagishLi();
        }
      } catch { /* התוסף אופציונלי — בלי קבצים או בלי רשת האתר ממשיך כרגיל */ }
    }, 1500); // אחרי טעינת התוכן — לא מתחרה על רוחב הפס של העמוד עצמו
    return () => { cancelled = true; clearTimeout(t); };
  }, []);
  return null;
}
