'use client';

import { useEffect, useState } from 'react';
import InternalShell from '../components/InternalShell';
import { DARK, BLUE, MUTED, BORDER } from '../lib/tenderMeta';

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
    status: 'active',
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
    name: 'מש"מ — מרכז השלטון המקומי',
    desc: "מכרזים וקולות קוראים לרשויות המקומיות — מכרזי מסגרת ארציים של השלטון המקומי",
    host: 'masham.org.il',
    url: 'https://masham.org.il/bids/',
    icon: '🏛️',
    status: 'active',
  },
  {
    name: "משרד החינוך — קולות קוראים לרשויות",
    desc: "פורטל רשויות ובעלויות חינוך — קולות קוראים לתקצוב תוכניות חינוך",
    host: 'pob.education.gov.il',
    url: 'https://pob.education.gov.il/kolotkorim/kolkore/',
    icon: '🎓',
    status: 'active',
  },
  {
    name: 'קק"ל — מכרזים והתקשרויות',
    desc: "מכרזי קרן קימת לישראל — ייעור, פיתוח, תשתיות ושירותים",
    host: 'kkl.org.il',
    url: 'https://www.kkl.org.il/about-us/tenders/',
    icon: '🌲',
    status: 'active',
  },
  {
    name: "דקל מכרז — פלטפורמת מאות גופים",
    desc: "פלטפורמת פרסום מכרזים מקוונת של רשויות, אוניברסיטאות וחברות ציבוריות — עיריית ירושלים, מוריה, נתיבי איילון, רש\"ת, אוניברסיטת בן גוריון ועוד. הפרסום הרשמי של כל גוף, במקור אחד",
    host: 'bids.dekel.co.il',
    url: 'https://bids.dekel.co.il/',
    icon: '📋',
    status: 'active',
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
    name: "רשות החדשנות — קולות קוראים",
    desc: "מסלולי הטבה, קולות קוראים והליכים תחרותיים למענקי מו\"פ — רלוונטי לחברות טכנולוגיה, סטארט-אפים ותעשייה",
    host: 'innovationisrael.org.il',
    url: 'https://innovationisrael.org.il/kol_kore/',
    icon: '💡',
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

  // ---------- גל רביעי: בריאות ----------
  { name: "שירותי בריאות כללית", desc: "מכרזי הקופה הגדולה בישראל — מחשוב, רכש בתי חולים, מחוזות וקולות קוראים, בהיקפי עתק", host: 'clalit.co.il', url: 'https://www.clalit.co.il/he/info/tenders/Pages/default.aspx', icon: '🏥', status: 'pilot' },
  { name: "קופת חולים לאומית", desc: "מכרזים פומביים פעילים — רכש שוטף בתחומי בריאות, לוגיסטיקה ושירותים", host: 'leumit.co.il', url: 'https://www.leumit.co.il/bids/publictenders/', icon: '⚕️', status: 'pilot' },
  { name: "איכילוב — סוראסקי", desc: "מכרזי תאגיד הבריאות של המרכז הרפואי תל אביב — ציוד רפואי, שירותים ותשתיות", host: 'tasmc.org.il', url: 'https://www.tasmc.org.il/all/michrazim-health-corp/', icon: '🏥', status: 'pilot' },
  { name: "הדסה", desc: "ועדת התקשרויות ומכרזי המרכז הרפואי הדסה — רכש רפואי ולוגיסטי", host: 'hadassah.org.il', url: 'https://he.hadassah.org.il/center/vaadat-itkashruyot/', icon: '🏥', status: 'pilot' },
  { name: 'רמב"ם — הקריה הרפואית', desc: "מכרזים פומביים של תאגיד הבריאות רמב\"ם — ציוד, שירותים ותשתיות", host: 'rambam.org.il', url: 'https://www.rambam.org.il/departmentsandclinics/purchasing-department/public-tenders/', icon: '🏥', status: 'pilot' },
  { name: "שמיר (אסף הרופא)", desc: "מכרזי המרכז הרפואי שמיר — רכש רפואי, שירותים ותחזוקה", host: 'shamir.org', url: 'https://www.shamir.org/he/about/tenders/', icon: '🏥', status: 'pilot' },
  { name: "שיבא תל השומר", desc: "מכרזי המרכז הרפואי שיבא — הרשימה נטענת ב-JS; מכוסה חלקית דרך מינהל הרכש הממשלתי", host: 'sheba.co.il', url: 'https://www.sheba.co.il/146810', icon: '🏥', status: 'candidate' },

  // ---------- גל רביעי: תשתיות, אנרגיה, מים וחברות ממשלתיות ----------
  { name: 'נתג"ז — נתיבי הגז הטבעי', desc: "מכרזי תשתיות גז ואנרגיה — פרויקטים, צנרת, HSE ושירותים, עם מפרטים וקבצים מצורפים", host: 'ingl.co.il', url: 'https://www.ingl.co.il/tenders/', icon: '🔥', status: 'pilot' },
  { name: "נמל אשדוד", desc: "מכרזי רכש, תפעול ותשתיות של חברת נמל אשדוד", host: 'ashdodport.co.il', url: 'https://www.ashdodport.co.il/about/opportunities/pages/tenders.aspx', icon: '⚓', status: 'pilot' },
  { name: 'חברת נמלי ישראל — חנ"י', desc: "מכרזי פיתוח ותשתית של חברת הנמלים הממשלתית", host: 'israports.co.il', url: 'https://www.israports.co.il/he/TendersRegistration/Pages/default.aspx', icon: '🚢', status: 'pilot' },
  { name: "עמיגור", desc: "מכרזי שיפוצים, בינוי, ניהול ותחזוקת דיור ציבורי", host: 'amigour.co.il', url: 'https://www.amigour.co.il/tenders/', icon: '🏗️', status: 'pilot' },
  { name: "נמל חיפה", desc: "מכרזי חברת נמל חיפה — האתר חסום מחוץ לישראל, נדרש proxy ישראלי", host: 'haifaport.co.il', url: 'https://www.haifaport.co.il/tenders/', icon: '⚓', status: 'candidate' },
  { name: "חוצה ישראל (כביש 6)", desc: "מכרזי כבישי אגרה ותחבורה — האתר חסום מחוץ לישראל, נדרש proxy ישראלי", host: 'transisrael.co.il', url: 'https://www.transisrael.co.il/Tenders', icon: '🛣️', status: 'candidate' },
  { name: "עמידר", desc: "מכרזי דיור ציבורי, שיפוצים ותחזוקה — פורטל WebSphere חסום, נדרש proxy ישראלי", host: 'amidar.co.il', url: 'https://www.amidar.co.il/wps/portal/amidar/service/tenders', icon: '🏘️', status: 'candidate' },
  { name: 'קצא"א (EAPC)', desc: "מכרזי תשתיות נפט ואנרגיה — האתר נטען ב-JS, נדרש מיפוי API", host: 'eapc.co.il', url: 'https://www.eapc.co.il/contractors-and-suppliers', icon: '🛢️', status: 'candidate' },
  { name: "דואר ישראל", desc: "מכרזי לוגיסטיקה, רכש ונכסים — מערכת בתהליך מעבר ל-SPA, נדרשת כתובת view ישירה", host: 'israelpost.co.il', url: 'https://doar.israelpost.co.il/content/tenders', icon: '📮', status: 'candidate' },

  // ---------- גל רביעי: מוסדות להשכלה גבוהה ----------
  { name: "האוניברסיטה העברית", desc: "מכרזי רכש, שירותים ובינוי של האוניברסיטה העברית בירושלים", host: 'huji.ac.il', url: 'https://tenders.huji.ac.il/bids/', icon: '🎓', status: 'pilot' },
  { name: "הטכניון", desc: "מכרזי יחידת המכרזים של הטכניון — רכש, שירותים ותשתיות", host: 'technion.ac.il', url: 'https://michrazim.technion.ac.il/tenders-list/', icon: '🎓', status: 'pilot' },
  { name: "אוניברסיטת בר-אילן", desc: "מכרזי אגף התפעול — רכש, שירותים ובינוי", host: 'biu.ac.il', url: 'https://tiful.biu.ac.il/michrazim', icon: '🎓', status: 'pilot' },
  { name: "אוניברסיטת בן-גוריון", desc: "מכרזים פומביים של אוניברסיטת בן-גוריון בנגב", host: 'bgu.ac.il', url: 'https://w3.bgu.ac.il/bengurionbids/bidsList.aspx?dep=100', icon: '🎓', status: 'pilot' },
  { name: "אוניברסיטת חיפה", desc: "מכרזים פעילים, ספק יחיד וארכיון של אוניברסיטת חיפה", host: 'haifa.ac.il', url: 'https://tender.haifa.ac.il/', icon: '🎓', status: 'pilot' },
  { name: "מכון ויצמן למדע", desc: "מכרזים פומביים והתקשרויות של מכון ויצמן — מחקר, ציוד ותשתיות", host: 'weizmann.ac.il', url: 'https://www.weizmann.ac.il/michrazim/public-tenders', icon: '🔬', status: 'pilot' },
  { name: "האוניברסיטה הפתוחה", desc: "מכרזי רכש, שירותים וספק יחיד של האוניברסיטה הפתוחה", host: 'openu.ac.il', url: 'https://www.openu.ac.il/bid/', icon: '🎓', status: 'pilot' },
  { name: "אוניברסיטת אריאל", desc: "מכרזים והחלטות ועדה של אוניברסיטת אריאל בשומרון", host: 'ariel.ac.il', url: 'https://www.ariel.ac.il/wp/auctions-and-decisions/מכרזים/', icon: '🎓', status: 'pilot' },

  // ---------- גל רביעי: תאגידים עירוניים, מים וחברות כלכליות ----------
  { name: "מי אביבים", desc: "מכרזי תאגיד המים של תל אביב — תשתיות מים וביוב, רכש ושירותים", host: 'mei-avivim.co.il', url: 'https://www.mei-avivim.co.il/מכרזים-פומביים/', icon: '💧', status: 'pilot' },
  { name: "מי כרמל", desc: "מכרזים פתוחים של תאגיד המים מי כרמל — תשתיות ושירותים", host: 'mei-carmel.co.il', url: 'https://www.mei-carmel.co.il/מכרזים/', icon: '💧', status: 'pilot' },
  { name: "עזרה וביצרון", desc: "מכרזי החברה הכלכלית עזרה וביצרון (תל אביב) — בינוי, נדל\"ן ותשתיות", host: 'e-b.co.il', url: 'https://www.e-b.co.il/מכרזים/', icon: '🏢', status: 'pilot' },
  { name: "אחוזות החוף", desc: "מכרזי החברה הכלכלית אחוזות החוף (תל אביב) — חניונים, נדל\"ן ותשתיות", host: 'ahuzot.co.il', url: 'https://www.ahuzot.co.il/tenders/', icon: '🏢', status: 'pilot' },
  { name: "חברת אתרים", desc: "מכרזי פיתוח, נדל\"ן ומרינות של חברת אתרים", host: 'atarim.gov.il', url: 'https://www.atarim.gov.il/מכרזים/', icon: '🏖️', status: 'pilot' },
  { name: "יפה נוף (חיפה)", desc: "מכרזי תחבורה, תשתיות ובנייה של יפה נוף חיפה", host: 'yefenof.co.il', url: 'https://www.yefenof.co.il/tenders', icon: '🏗️', status: 'pilot' },
  { name: "הגיחון (ירושלים)", desc: "מכרזי תאגיד המים הגיחון — האתר חסום מחוץ לישראל, נדרש proxy ישראלי", host: 'hagihon.co.il', url: 'https://www.hagihon.co.il/מכרזים-וספקים/מכרזים-פעילים/', icon: '💧', status: 'candidate' },
  { name: "ח.ל.ת נתניה", desc: "מכרזי החברה לפיתוח ותיירות נתניה — CMS חוסם, נדרש proxy ישראלי", host: 'halat.co.il', url: 'https://www.halat.co.il/html5/?_id=12157&did=2300&g=12157', icon: '🏢', status: 'candidate' },
  { name: "מניב ראשון", desc: "מכרזי החברה העירונית של ראשון לציון — SharePoint ללא אינדקס ציבורי, נדרש מיפוי", host: 'meniv-rishon.co.il', url: 'https://www.meniv-rishon.co.il/', icon: '🏢', status: 'candidate' },

  // ---------- גל רביעי: ביטחוני וממשלתי נוסף ----------
  { name: 'משהב"ט — סחר חוץ (סיב"ת)', desc: "מכרזי מינהל הסחר החוץ-ביטחוני של משרד הביטחון", host: 'online.mod.gov.il', url: 'https://www.online.mod.gov.il/Online2016/Pages/General/Sibat/TendersList.aspx?Reset=1', icon: '🛡️', status: 'pilot' },
  { name: "התעשייה האווירית (תע\"א)", desc: "אין רשימת מכרזים פומבית — מכרזים בפורטלי מכרז הפוך סגורים בהזמנה אישית", host: 'iai.co.il', url: 'https://www.iai.co.il/heb/suppliers', icon: '✈️', status: 'candidate' },
  { name: "רפאל", desc: "אין רשימת מכרזים פומבית — מתפרסמים בערוצים ממשלתיים/משהב\"ט", host: 'rafael.co.il', url: 'https://he.rafael.co.il/suppliers/', icon: '🛡️', status: 'candidate' },
  { name: "ילקוט הפרסומים (רשומות)", desc: "מכרזים משפטיים, פירוקים וכינוסי נכסים — Angular + PDF, נדרש מיפוי ה-collector", host: 'gov.il', url: 'https://www.gov.il/he/departments/dynamiccollectors/gazette-official', icon: '📜', status: 'candidate' },
  // ---------- גל חמישי: עיריות ומוסדות נוספים ----------
  { name: "עיריית חיפה", desc: "מכרזי רכש, שירותים ותשתיות של עיריית חיפה", host: 'haifa.muni.il', url: 'https://www2.haifa.muni.il/Michrazim/Default.aspx', icon: '🏙️', status: 'pilot' },
  { name: "עיריית ראשון לציון", desc: "מכרזי רכש ועבודות קבלניות של עיריית ראשון לציון", host: 'rishonlezion.muni.il', url: 'https://www.rishonlezion.muni.il/Activities/Tenders/Pages/Contracting_tenders.aspx', icon: '🏙️', status: 'pilot' },
  { name: "עיריית באר שבע", desc: "מכרזי רכש, בינוי ושירותים של עיריית באר שבע", host: 'beer-sheva.muni.il', url: 'https://www.beer-sheva.muni.il/City/FreeInfo/Rehesh/Pages/Bids.aspx', icon: '🏙️', status: 'pilot' },
  { name: "עיריית חולון", desc: "מכרזי רכש, בינוי, שירותים וקולות קוראים של עיריית חולון", host: 'holon.muni.il', url: 'https://www.holon.muni.il/CityHall/Bids/Pages/default.aspx', icon: '🏙️', status: 'pilot' },
  { name: "עיריית אשדוד", desc: "מכרזים פעילים של עיריית אשדוד", host: 'ashdod.muni.il', url: 'https://www.ashdod.muni.il/he-il/אתר-העיר/מכרזים/מכרזים-פעילים/', icon: '🏙️', status: 'pilot' },
  { name: "עיריית תל אביב-יפו", desc: "מכרזי רכש, שירותים ועבודה קבלנית — נטען ב-JS מאחורי WAF, נדרש proxy", host: 'tel-aviv.gov.il', url: 'https://www.tel-aviv.gov.il/AuctionAndCareers/Pages/Service.aspx', icon: '🏙️', status: 'candidate' },
  { name: "עיריית פתח תקווה", desc: "מכרזי רכש ושירותים — חסום ב-WAF, נדרש proxy ישראלי", host: 'petah-tikva.muni.il', url: 'https://www.petah-tikva.muni.il/city-and-municipality/bids/bids', icon: '🏙️', status: 'candidate' },
  { name: "עיריית נתניה", desc: "מכרזי העירייה — הרשימה נטענת ב-JS, נדרש מיפוי", host: 'netanya.muni.il', url: 'https://www.netanya.muni.il/tenders/Pages/tenderLists.aspx', icon: '🏙️', status: 'candidate' },
  { name: "המכללה האקדמית ספיר", desc: "מכרזי רכש, שירותים וספק יחיד של מכללת ספיר", host: 'sapir.ac.il', url: 'https://www.sapir.ac.il/tenders', icon: '🎓', status: 'pilot' },
  { name: "שנקר", desc: "מכרזי שנקר — הנדסה, עיצוב ואמנות", host: 'shenkar.ac.il', url: 'https://www.shenkar.ac.il/he/pages/tenders-shenkar/', icon: '🎓', status: 'pilot' },
  { name: "HIT חולון", desc: "מכרזי המכון הטכנולוגי חולון — רכש, שירותים ותשתיות", host: 'hit.ac.il', url: 'https://www.hit.ac.il/tenders/', icon: '🎓', status: 'pilot' },
  { name: "המכללה האקדמית ת\"א-יפו", desc: "מכרזי רכש ושירותים של המכללה האקדמית תל אביב-יפו", host: 'mta.ac.il', url: 'https://www.mta.ac.il/tenders', icon: '🎓', status: 'pilot' },
  { name: "אורט בראודה", desc: "מכרזי המכללה האקדמית להנדסה אורט בראודה (כרמיאל)", host: 'braude.ac.il', url: 'https://w3.braude.ac.il/about/tenders/', icon: '🎓', status: 'pilot' },
  { name: "המכללה האקדמית עמק יזרעאל", desc: "מכרזים ופטורים של המכללה האקדמית עמק יזרעאל", host: 'yvc.ac.il', url: 'https://www.yvc.ac.il/tender/', icon: '🎓', status: 'pilot' },
  { name: "מכללת רופין", desc: "מכרזי רכש של המרכז האקדמי רופין — נטען ב-JS, נדרש מיפוי", host: 'ruppin.ac.il', url: 'https://www.ruppin.ac.il/tenders/', icon: '🎓', status: 'candidate' },
  { name: "רשות הטבע והגנים", desc: "מכרזי פיתוח, תחזוקה ושירותים של רשות הטבע והגנים", host: 'parks.org.il', url: 'https://www.parks.org.il/tenders/', icon: '🌳', status: 'pilot' },
  { name: "רמ\"י — מכרזי רכש", desc: "מכרזי רכש והתקשרות של רשות מקרקעי ישראל (נבדל ממכרזי הקרקע)", host: 'land.gov.il', url: 'https://land.gov.il/Pages/Tenders.aspx', icon: '🗺️', status: 'pilot' },
  { name: "נמל אילת", desc: "מכרזי חברת נמל אילת — נפח נמוך", host: 'eilatport.co.il', url: 'https://eilatport.co.il/tenders/', icon: '⚓', status: 'pilot' },

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
        // QA #18: קודם נמשך כל המאגר (10 בקשות) רק בשביל שני מספרים — וה-spinner נתקע לנצח.
        // עכשיו אותו מקור כמו הסרגל: /api/nav-counts (מונה + זמן סנכרון).
        fetch('/api/nav-counts').then(r => r.ok ? r.json() : null).then((res: any) => {
                setCount(res && typeof res.active === 'number' ? res.active : 0);
                setUpdated(res?.fetchedAt
                                   ? new Date(res.fetchedAt).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                   : 'לא ידוע');
                setLoading(false);
        }).catch(() => { setCount(0); setUpdated('לא ידוע'); setLoading(false); });
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
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: k.c, minHeight: 28, display: 'flex', alignItems: 'center' }}>{k.v}</div>
            <div style={{ fontSize: '0.75rem', color: MUTED, marginTop: 3 }}>{k.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {SOURCES.map((s, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid ' + BORDER, borderRadius: 10, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ fontSize: '1.625rem', lineHeight: 1 }}>{s.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: '0.96875rem', fontWeight: 700, color: DARK }}>{s.name}</span>
                <span style={{ fontSize: '0.71875rem', fontWeight: 600, color: s.status === 'active' ? '#1e7d45' : s.status === 'pilot' ? '#8a5db8' : '#a06a1b', background: s.status === 'active' ? '#e7f6ec' : s.status === 'pilot' ? '#f3ecfb' : '#fdf3e3', borderRadius: 6, padding: '2px 8px' }}>{s.status === 'active' ? "פעיל" : s.status === 'pilot' ? "בהרצה" : "מועמד לאינטגרציה"}</span>
              </div>
              <div style={{ fontSize: '0.84375rem', color: MUTED, marginBottom: 10, lineHeight: 1.5 }}>{s.desc}</div>
              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', fontWeight: 600, color: BLUE, textDecoration: 'none' }}>{"לצפייה במקור"} ← {s.host}</a>
            </div>
          </div>
        ))}
      </div>
    </InternalShell>
  );
}
