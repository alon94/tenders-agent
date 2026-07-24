'use client';

import { useEffect, useState } from 'react';
import InternalShell from '../components/InternalShell';
import { DARK, BLUE, MUTED, BORDER } from '../lib/tenderMeta';
import { fetchDedupedTenders } from '../lib/tenderData';

type SourceStatus = 'active' | 'pilot' | 'candidate';

const SOURCES: { name: string; desc: string; host: string; url: string; icon: string; status: SourceStatus }[] = [
  // ---------- מקורות פעילים ----------
  {
    name: "מינהל הרכש הממשלתי",
    desc: "נסרק ישירות מהפורטל הרשמי — סטטוסים ותאריכים בזמן אמת, כולל מכרזים שטרם הגיעו למראה",
    host: 'mr.gov.il',
    url: 'https://mr.gov.il/ilgstorefront/he/',
    icon: '🏛️',
    status: 'active',
  },
  {
    name: "obudget – התקציב הפתוח",
    desc: "מקור רשימת המכרזים — רשימה, סטטוסים ותאריכים",
    host: 'next.obudget.org',
    url: 'https://next.obudget.org/',
    icon: '📊',
    status: 'active',
  },
  {
    name: "מכרזי רשויות מקומיות",
    desc: "מכרזים מוניציפליים מעיריות ומועצות — נאספים מאתרי הרשויות",
    host: 'next.obudget.org',
    url: 'https://next.obudget.org/',
    icon: '🏙️',
    status: 'active',
  },
  // ---------- מועמדים לאינטגרציה ----------
  {
    name: "רשות מקרקעי ישראל — מכרזי מקרקעין",
    desc: "מכרזי קרקע פעילים, תוצאות ומכרזים על המפה — מכסה את תחום הנדל\"ן והמקרקעין. אפליקציה עם backend נתונים — מועמד קל לאינטגרציה",
    host: 'apps.land.gov.il',
    url: 'https://apps.land.gov.il/MichrazimSite/',
    icon: '🗺️',
    status: 'active',
  },
  {
    name: "משרד הביטחון — אתר סחר אלקטרוני",
    desc: "בקשות להצעות מחיר (בל\"מ) ומכרזי רכש ביטחוני — רכש משהב\"ט אינו מתפרסם במינהל הרכש הממשלתי",
    host: 'online.mod.gov.il',
    url: 'https://www.online.mod.gov.il/Online2016/Pages/General/Balam/BalamList.aspx',
    icon: '🛡️',
    status: 'active',
  },
  {
    name: "משכ\"ל — החברה למשק וכלכלה",
    desc: "מכרזי מסגרת של השלטון המקומי — מקור אחד המשרת עשרות רשויות בתחומי חינוך, בינוי, תשתיות ושירותים",
    host: 'mashcal.co.il',
    url: 'https://www.mashcal.co.il/our-tenders/',
    icon: '🏘️',
    status: 'pilot',
  },
  {
    name: "מפעל הפיס",
    desc: "מכרזים, החלטות ועדת רכש ומאגר ספקים — תכנון, אדריכלות, ניהול פרויקטים, ייעוץ ומדידות",
    host: 'pais.co.il',
    url: 'https://www.pais.co.il/Tenders/',
    icon: '🎯',
    status: 'pilot',
  },
  {
    name: "קופת חולים מאוחדת",
    desc: "מכרזים פעילים, פטורים וספק יחיד — רכש שוטף בתחומי בריאות, מחשוב, לוגיסטיקה ושירותים",
    host: 'meuhedet.co.il',
    url: 'https://www.meuhedet.co.il/מכרזים/מכרזים-פעילים/',
    icon: '🏥',
    status: 'pilot',
  },
  {
    name: "מכבי שירותי בריאות",
    desc: "מכרזים, בקשות הצעות מחיר ו-RFI — הזדמנויות רבות בהיקפים המתאימים לעסקים קטנים ובינוניים",
    host: 'maccabi4u.co.il',
    url: 'https://www.maccabi4u.co.il/bids/',
    icon: '⚕️',
    status: 'active',
  },
  {
    name: "המוסד לביטוח לאומי",
    desc: "מכרזים, ספק יחיד ותוצאות — רכש של אחד הגופים הציבוריים הגדולים במשק",
    host: 'btl.gov.il',
    url: 'https://www.btl.gov.il/About/tenders/Pages/default.aspx',
    icon: '🏦',
    status: 'active',
  },
  {
    name: "נתיבי ישראל",
    desc: "מכרזי תשתיות, תכנון, ביצוע, אחזקה ומערכות מידע + מאגר ספקים מומחים",
    host: 'iroads.co.il',
    url: 'https://www.iroads.co.il/מכרזים/מכרזים/',
    icon: '🛣️',
    status: 'pilot',
  },
  {
    name: "נתיבי איילון",
    desc: "לובי מכרזים והתקשרויות — פרויקטי תחבורה מטרופולינית, נתיבים מהירים ותחבורה חכמה",
    host: 'ayalonhw.co.il',
    url: 'https://www.ayalonhw.co.il/tenders/tenders-lobby/',
    icon: '🚦',
    status: 'pilot',
  },
  {
    name: "דקל מכרז — פלטפורמת מאות גופים",
    desc: "פלטפורמת פרסום מכרזים מקוונת של רשויות, אוניברסיטאות וחברות ציבוריות — עיריית ירושלים, מוריה, נתיבי איילון, רש\"ת, אוניברסיטת בן גוריון ועוד. הפרסום הרשמי של כל גוף, במקור אחד",
    host: 'bids.dekel.co.il',
    url: 'https://bids.dekel.co.il/',
    icon: '📋',
    status: 'pilot',
  },
  {
    name: "רכבת ישראל",
    desc: "מכרזי רכש, תפעול ומטענים — מכרזים פתוחים, ספק יחיד והודעות פטור",
    host: 'rail.co.il',
    url: 'https://www.rail.co.il/?page=GeneralAuctions&lan=he',
    icon: '🚆',
    status: 'pilot',
  },
  {
    name: 'נת"ע — מטרו ורכבת קלה',
    desc: "מכרזי הקמה, תשתיות ושירותים לפרויקטי המטרו והרכבת הקלה בגוש דן",
    host: 'nta.co.il',
    url: 'https://www.nta.co.il/tenders/',
    icon: '🚇',
    status: 'pilot',
  },
  {
    name: "רשות שדות התעופה",
    desc: "מכרזי רכש, הפעלה וזכיינות בנתב\"ג, שדות התעופה ומעברי הגבול",
    host: 'iaa.gov.il',
    url: 'https://www.iaa.gov.il/he-IL/Tenders/TendersArchive/Pages/default.aspx',
    icon: '✈️',
    status: 'active',
  },
  {
    name: "אוניברסיטת תל אביב",
    desc: "אתר מכרזים ייעודי לפי תקנות חובת המכרזים למוסדות השכלה גבוהה — רכישה, מכירה וספק יחיד",
    host: 'tenders.tau.ac.il',
    url: 'https://tenders.tau.ac.il/tenders',
    icon: '🎓',
    status: 'active',
  },
  {
    name: "הרשות לפיתוח ירושלים",
    desc: "מכרזי פיתוח עירוני, מאגרי ספקים, יועצים ומתכננים",
    host: 'jda.gov.il',
    url: 'https://www.jda.gov.il/מכרזים/',
    icon: '🏛️',
    status: 'active',
  },
  {
    name: "חברת החשמל",
    desc: "מכרזים ממוכנים ופורטל ספקים — הערה: האתר חסום מחוץ לישראל, נדרש proxy ישראלי לסריקה אוטומטית",
    host: 'iec.co.il',
    url: 'https://www.iec.co.il/content/suppliers/content-pages/tendersinfo',
    icon: '⚡',
    status: 'candidate',
  },
];

const ACTIVE = SOURCES.filter((s) => s.status === 'active');
const PILOTS = SOURCES.filter((s) => s.status === 'pilot');
const CANDIDATES = SOURCES.filter((s) => s.status === 'candidate');

function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid ' + BORDER, borderTopColor: BLUE, borderRadius: '50%', animation: 'sourcesSpin 0.7s linear infinite', verticalAlign: 'middle' }} />
  );
}

export default function SourcesPage() {
  const [count, setCount] = useState<number | null>(null);
  const [updated, setUpdated] = useState<string>('—');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
        fetchDedupedTenders().then((res: any) => {
                setCount(res.tenders.length);
                setUpdated(res.fetchedAt
                                   ? new Date(res.fetchedAt).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                   : new Date().toLocaleDateString('he-IL'));
                setLoading(false);
        }).catch(() => { setCount(0); setLoading(false); });
  }, []);

  const kpiCells = [
    { v: loading ? <Spinner /> : (count === null ? '…' : count.toLocaleString('he-IL')), l: "מכרזים זמינים", c: DARK },
    { v: String(ACTIVE.length), l: "מקורות פעילים", c: '#1e7d45' },
    { v: String(PILOTS.length), l: "בהרצה", c: '#8a5db8' },
    { v: String(CANDIDATES.length), l: "מועמדים לאינטגרציה", c: '#a06a1b' },
    { v: loading ? <Spinner /> : updated, l: "עדכון אחרון", c: BLUE },
  ];

  return (
    <InternalShell title={"מקורות נתונים"} subtitle={"המקורות שמזינים את הפלטפורמה בזמן אמת"}>
      <style>{`@keyframes sourcesSpin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', background: '#fff', border: '1px solid ' + BORDER, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
        {kpiCells.map((k, i) => (
          <div key={i} style={{ padding: '16px 18px', borderInlineEnd: i < kpiCells.length - 1 ? '1px solid ' + BORDER : 'none' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.c, minHeight: 28, display: 'flex', alignItems: 'center' }}>{k.v}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{k.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {SOURCES.map((s, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid ' + BORDER, borderRadius: 10, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ fontSize: 26, lineHeight: 1 }}>{s.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 15.5, fontWeight: 700, color: DARK }}>{s.name}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: s.status === 'active' ? '#1e7d45' : s.status === 'pilot' ? '#8a5db8' : '#a06a1b', background: s.status === 'active' ? '#e7f6ec' : s.status === 'pilot' ? '#f3ecfb' : '#fdf3e3', borderRadius: 6, padding: '2px 8px' }}>{s.status === 'active' ? "פעיל" : s.status === 'pilot' ? "בהרצה" : "מועמד לאינטגרציה"}</span>
              </div>
              <div style={{ fontSize: 13.5, color: MUTED, marginBottom: 10, lineHeight: 1.5 }}>{s.desc}</div>
              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: BLUE, textDecoration: 'none' }}>{"לצפייה במקור"} ← {s.host}</a>
            </div>
          </div>
        ))}
      </div>
    </InternalShell>
  );
}
