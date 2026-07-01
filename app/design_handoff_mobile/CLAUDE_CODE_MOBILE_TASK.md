# משימת Claude Code — גרסת מובייל לאפליקציית tenders-agent

> **איך להשתמש:** הדבק את כל הקובץ הזה כהודעה ל-Claude Code בתוך ה-repo `alon94/tenders-agent`. הוא כתוב כהוראות ישירות לסוכן.

---

## ההקשר והבעיה
האפליקציה היא Next.js App Router (RTL, עברית, פונט Heebo). דף `app/dashboard/page.tsx` מרנדר את המכרזים כ**טבלה** עם:
- `display:'flex'` עם **סרגל צד ברוחב קבוע `flex:'0 0 238px'`**, וגם
- שורות טבלה עם **גריד ברוחב קבוע** `gridTemplateColumns:'70px 1fr 232px 156px 96px'`.

שני אלה **אינם רספונסיביים**. במסך מובייל הסרגל תופס כמעט את כל הרוחב, עמודת הכותרת (`1fr`) נדחסת לרוחב זעום, והכותרת נשברת אות-אות (כל אות בשורה). אותה בעיה קיימת בדפים הפנימיים.

**המטרה:** להוסיף גרסת מובייל נכונה **בלי לשבור את הדסקטופ**. בדסקטופ (≥769px) הכל נשאר כמו שהוא. במובייל (≤768px): מסתירים את הסרגל, ממירים את שורות הטבלה לכרטיסים מוערמים, ומוסיפים ניווט תחתון קבוע.

## עקרונות מנחים (חובה לשמור)
- **RTL** בכל מקום (`direction:'rtl'`).
- **טוקנים קיימים** — אל תמציא צבעים. השתמש בקבועים שכבר בקובץ: `DARK='#1a2330'`, `BLUE='#2b6fc4'`, `MUTED='#667380'`, `BORDER='#e6eaee'`, ותכלת פעיל `#e8f1fb`/טקסט `#1e5aa8`/גבול `#cfe0f4`. סטטוסים כפי ש-`statusTags()` כבר מחזיר. `bandColor()` לפס הציון.
- **פונט**: המשך עם המחסנית הקיימת בדף.
- כותרות מכרז חייבות לזרום: `lineHeight:1.4`, ללא רוחב קבוע שגורם לשבירה.
- אזורי מגע ≥44px.
- כבד את `safe-area-inset-bottom` בסרגל התחתון.

---

## שלב 1 — זיהוי מובייל (hook)
צור `app/hooks/useIsMobile.ts`:
```ts
'use client';
import { useEffect, useState } from 'react';
export function useIsMobile(bp = 768) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [bp]);
  return m;
}
```

## שלב 2 — קומפוננטת ניווט תחתון
צור `app/components/MobileTabBar.tsx`:
```tsx
'use client';
import { usePathname } from 'next/navigation';
const TABS = [
  { icon: '◧', label: 'גילוי', href: '/dashboard' },
  { icon: '★', label: 'מסומנים', href: '/marked' },
  { icon: '◈', label: 'סוכן', href: '/agent' },
  { icon: '▤', label: 'ערבויות', href: '/guarantee' },
  { icon: '⛁', label: 'מקורות', href: '/sources' },
];
const BLUE = '#2b6fc4', MUTED = '#8a97a3', BORDER = '#e6eaee';
export default function MobileTabBar() {
  const path = usePathname();
  return (
    <nav style={{
      position: 'fixed', insetInline: 0, bottom: 0, zIndex: 200,
      background: '#fff', borderTop: `1px solid ${BORDER}`,
      padding: '8px 8px calc(8px + env(safe-area-inset-bottom))',
      display: 'flex', justifyContent: 'space-around', direction: 'rtl',
    }}>
      {TABS.map(t => {
        const active = path === t.href || path?.startsWith(t.href + '/');
        return (
          <a key={t.href} href={t.href} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            textDecoration: 'none', minWidth: 56,
            color: active ? BLUE : MUTED, fontWeight: active ? 700 : 500,
          }}>
            <span style={{ fontSize: 19 }}>{t.icon}</span>
            <span style={{ fontSize: 10 }}>{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
```
רנדר אותו רק במובייל (בכל דף פנימי, או ב-`layout.tsx` עם בדיקת `useIsMobile`). כשהוא מוצג — הוסף `paddingBottom: 72` לתחתית התוכן כדי שלא יוסתר.

## שלב 3 — `dashboard/page.tsx` רספונסיבי
בתוך הקומפוננטה:
```tsx
const isMobile = useIsMobile();
```

**(א) הסתר את הסרגל במובייל** — על ה-`div` של הסרגל (`flex:'0 0 238px'…`):
```tsx
...(isMobile ? { display: 'none' } : {})
```

**(ב) Header** — במובייל הפוך לעמודה קומפקטית: הסתר את אינדיקטור "עודכן…" ואת כפתור "✦ תובנות AI" הצדדי, השאר כותרת + חיפוש בשורה נפרדת ברוחב מלא. למשל padding `12px 16px`, `flexWrap:'wrap'`, שדה החיפוש `flex:'1 1 100%'`.

**(ג) KPI strip** — במובייל אפשר גלילה אופקית במקום 4 עמודות דחוסות:
```tsx
gridTemplateColumns: isMobile ? undefined : 'repeat(4,1fr)',
...(isMobile ? { display:'flex', overflowX:'auto', gap:10, background:'transparent', border:'none' } : {})
```
ובכל תא במובייל: `minWidth:120, border:'1px solid #e6eaee', borderRadius:12`.

**(ד) שורות הטבלה → כרטיסים.** הסתר את שורת כותרת הטבלה במובייל (`{!isMobile && <div …headers…/>}`). בתוך ה-`rows.map(...)`, החלף את ה-`div` עם ה-`gridTemplateColumns` הקבוע ברינדור מותנה. גרסת המובייל:
```tsx
isMobile ? (
  <a href={`/tender/${t.id}`} key={t.id||i} style={{
    display:'block', textDecoration:'none', background:'#fff',
    border:'1px solid #e6eaee', borderRadius:16, padding:'15px 16px',
    borderBottom:'1px solid #e6eaee',
  }}>
    <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:11}}>
      <div style={{display:'flex', flexWrap:'wrap', gap:6, flex:1}}>
        {tags.map((g,gi)=>(<span key={gi} style={{fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:6,background:g.bg,color:g.fg,border:`1px solid ${g.bd}`}}>{g.label}</span>))}
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,flex:'0 0 auto'}}>
        <span style={{fontSize:22,fontWeight:700,color:DARK,lineHeight:1}}>{score}</span>
        <span style={{width:26,height:3,borderRadius:2,background:bandColor(score)}}></span>
      </div>
    </div>
    <div style={{fontSize:15,fontWeight:700,color:DARK,lineHeight:1.45,textAlign:'right'}}>{t.title||'ללא כותרת'}</div>
    <div style={{fontSize:12,color:'#7a8794',marginTop:8}}>{t.publisher||'לא ידוע'} · פורסם {fd(t.publishDate)}</div>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:13,paddingTop:12,borderTop:'1px solid #eef1f4'}}>
      <div style={{fontSize:12.5}}>
        <span style={{color:'#7a8794'}}>הגשה עד </span>
        <span style={{color:DARK,fontWeight:700}}>{fd(t.deadline)}</span>
        {d!==null&&d>=0&&<span style={{color:d<=7?'#b04a34':'#7a8794'}}> · נותרו {d} ימים</span>}
      </div>
      <button onClick={(e)=>toggleMark(t.id,e)} style={{fontSize:18,color:isMarked?'#d9a520':'#c2ccd6',background:'transparent',border:'none',cursor:'pointer',padding:6}}>{isMarked?'★':'☆'}</button>
    </div>
  </a>
) : (
  /* ← כאן נשאר בדיוק הבלוק הקיים של השורה בדסקטופ (הגריד עם 5 עמודות) */
)
```
> שים לב: הכרטיס עוטף ב-`<a>` לכל השורה כדי שקליק פותח את המכרז; כפתור הסימון מבצע `e.stopPropagation()` (כבר קיים ב-`toggleMark`).

**(ה) עטיפת המכולה** — במובייל הוסף `paddingBottom:72` ל-`div` התוכן (מתחת ל-KPI/טבלה) כדי לפנות מקום לניווט התחתון, ורנדר `<MobileTabBar/>` בסוף כאשר `isMobile`.

**(ו) Toolbar** — במובייל תן ל-selects (`biz`,`pub`) ולצ'יפים `flexWrap:'wrap'` ורוחב מלא לפי הצורך; אפשר להעביר את שלושת טאבי הסינון לגלילה אופקית.

## שלב 4 — דפים פנימיים (`marked`, `agent`, `guarantee`, `tender/[id]`)
- ודא שכל דף פנימי במובייל: תוכן ברוחב מלא, `padding:16`, `paddingBottom:72`, ורינדור `<MobileTabBar/>`.
- **`tender/[id]`**: כבר קיים `@media(max-width:700px)` ב-`globals.css` שמטפל ב-`.detail-grid`/`.tender-actions` — ודא שהפעולות (`.btn-primary`/`.btn-secondary`) הופכות לבר דביק תחתון ברוחב מלא במובייל.
- **`agent`**: פריסת צ'אט — בועות ברוחב עד ~86%, שדה קלט דביק תחתון עם כפתור שליחה עגול (`#2b6fc4`).
- **`marked`**: אותם כרטיסי מכרז כמו במובייל של הדשבורד + כפתור הסרה (✕) וכפתור "✦ החלט עבורי".
- **`guarantee`**: שני כרטיסי סיכום למעלה (סה"כ ערבויות / פגות החודש) ואז כרטיסי ערבות מוערמים.

## שלב 5 — בדיקה
- הרץ `npm run dev`, פתח `/dashboard` ברוחב 390px (DevTools → iPhone).
- ודא: הכותרות זורמות (לא נשברות אות-אות), אין גלילה אופקית של העמוד, הניווט התחתון קבוע ולא מסתיר תוכן, והדסקטופ (≥769px) ללא שינוי.
- בדוק גם `/marked`, `/agent`, `/guarantee`, `/tender/[id]`.

## מדדי הצלחה
1. אין שבירת טקסט אות-אות בשום מסך מובייל.
2. אין horizontal scroll ברמת העמוד ב-390px.
3. הדסקטופ נשאר זהה לחלוטין.
4. ניווט תחתון עובד ב-5 המסכים, טאב פעיל מודגש נכון.

---

### נספח — קבצים רלוונטיים ב-repo
- `app/dashboard/page.tsx` — הדף הראשי (הבעיה העיקרית).
- `app/components/SiteNav.tsx` — ניווט עליון קיים.
- `app/globals.css` — טוקנים ב-`:root` ומחלקות; כבר יש בו media queries חלקיים.
- `app/marked/page.tsx`, `app/agent/page.tsx`, `app/guarantee/page.tsx`, `app/tender/[id]/page.tsx` — דפים פנימיים.
- `app/types.ts` — טיפוס המכרז.

### התייחסות עיצובית
ראה `tenders-mobile-standalone.html` (בחבילת ה-Handoff) — סבב **3a** מדגים ויזואלית את 5 מסכי המובייל היעד.
