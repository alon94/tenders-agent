import { NextRequest, NextResponse } from 'next/server';

const BUDGETKEY_API = 'https://next.obudget.org/api/search';

// כל ערי ישראל, מועצות מקומיות ומועצות אזוריות
const ALL_ENTITIES = [
  // ערים גדולות
  'תל אביב', 'ירושלים', 'חיפה', 'ראשון לציון', 'פתח תקווה',
  'אשדוד', 'נתניה', 'באר שבע', 'בני ברק', 'רמת גן',
  'הרצליה', 'חולון', 'בת ים', 'אשקלון', 'רחובות',
  'בית שמש', 'כפר סבא', 'הוד השרון', 'לוד', 'רמלה',
  'מודיעין', 'נצרת', 'אילת', 'עפולה', 'נהריה',
  'אריאל', 'אלעד', 'ביתר עילית', 'מודיעין עילית', 'רעננה',
  'גבעתיים', 'גבעת שמואל', 'קריית אונו', 'אור יהודה', 'אזור',
  'קריית גת', 'קריית מלאכי', 'קריית ים', 'קריית אתא', 'קריית ביאליק',
  'קריית מוצקין', 'טירת כרמל', 'נשר', 'זכרון יעקב', 'עכו',
  'נהריה', 'מגדל העמק', 'אור עקיבא', 'חדרה', 'טולכרם',
  'ראש העין', 'כפר יונה', 'נס ציונה', 'גדרה', 'יבנה',
  'רהט', 'ירוחם', 'דימונה', 'אופקים', 'נתיבות',
  'שדרות', 'קריית שמונה', 'מעלות תרשיחא', 'שלומי', 'נצרת עילית',
  'טבריה', 'צפת', 'בית שאן', 'יוקנעם', 'טמרה',
  'סח\'נין', 'אום אל פחם', 'באקה אל גרביה', 'כסיפה', 'הורה',
  'ערד', 'מצפה רמון', 'טירה', 'כפר קאסם', 'לקיה',

  // מועצות מקומיות
  'כפר שמריהו', 'הרצליה פיתוח', 'שבי ציון', 'ראש פינה',
  'מגדל', 'עין גב', 'נוף הגליל', 'מרכז שפירא',
  'בית אריה', 'עופרים', 'מטה בנימין', 'גוש עציון',
  'אבן יהודה', 'כפר נטר', 'אחיעזר', 'גן יבנה',
  'גבעת ברנר', 'חמד', 'מזכרת בתיה', 'גדרה',

  // מועצות אזוריות
  'מועצה אזורית מרכז הגליל', 'מועצה אזורית גליל עליון',
  'מועצה אזורית גולן', 'מועצה אזורית בקעת בית הכרם',
  'מועצה אזורית עמק יזרעאל', 'מועצה אזורית גלבוע',
  'מועצה אזורית עמק המעיינות', 'מועצה אזורית בית שאן',
  'מועצה אזורית חוף הכרמל', 'מועצה אזורית מנשה',
  'מועצה אזורית שומרון', 'מועצה אזורית לב השרון',
  'מועצה אזורית חוף השרון', 'מועצה אזורית דרום השרון',
  'מועצה אזורית מודיעין', 'מועצה אזורית גזר',
  'מועצה אזורית שפלה', 'מועצה אזורית יואב',
  'מועצה אזורית שפיר', 'מועצה אזורית לכיש',
  'מועצה אזורית חבל יבנה', 'מועצה אזורית ברנר',
  'מועצה אזורית אשכול', 'מועצה אזורית שדות נגב',
  'מועצה אזורית בני שמעון', 'מועצה אזורית רמת נגב',
  'מועצה אזורית תמר', 'מועצה אזורית ערבה תיכונה',
  'מועצה אזורית חוף עזה', 'מועצה אזורית אלקסום',
  'מועצה אזורית בוסתן אלמרג', 'מועצה אזורית נאות סיני',
  'מועצה אזורית מגידו', 'מועצה אזורית גלות',

  // ממשלתי וכללי
  'מכרז ממשלתי', 'מינהל הרכש הממשלתי',
];

function parseTender(raw: Record<string, unknown>): Record<string, unknown> {
  const doc = (raw.source ?? raw) as Record<string, unknown>;
  return {
    id: String(doc.tender_id ?? doc.id ?? Math.random()),
    title: String(doc.tender_name ?? doc.description ?? 'מכרז ללא כותרת'),
    publisher: String(doc.publisher ?? doc.entity_name ?? 'גוף לא ידוע'),
    category: String(doc.tender_type ?? doc.sub_kind_he ?? 'כללי'),
    region: String(doc.city ?? 'כל הארץ'),
    deadline: doc.date_closed ? String(doc.date_closed) : null,
    budget: doc.volume ? Number(doc.volume) : null,
    description: String(doc.description ?? doc.tender_name ?? ''),
    url: doc.url ? String(doc.url) : 'https://www.mr.gov.il/',
    publishDate: String(doc.start_date ?? doc.date_updated ?? new Date().toISOString()),
    status: String(doc.tender_type ?? 'פתוח'),
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const customQuery = searchParams.get('q');

  const queries = customQuery
    ? [customQuery]
    : ALL_ENTITIES.map(e => `מכרז ${e}`);

  try {
    // סריקה מקבילית בחבילות של 10 כדי לא לעמוס על ה-API
    const chunkSize = 10;
    const allHits: Record<string, unknown>[] = [];

    for (let i = 0; i < queries.length; i += chunkSize) {
      const chunk = queries.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunk.map(q =>
          fetch(`${BUDGETKEY_API}?query=${encodeURIComponent(q)}&doc_types=tenders&size=50`, {
            cache: 'no-store',
          })
            .then(r => r.json())
            .catch(() => ({ hits: { hits: [] } }))
        )
      );
      results.forEach((d: Record<string, unknown>) => {
        const hits = (d?.hits as Record<string, unknown>)?.hits as Record<string, unknown>[];
        if (hits) allHits.push(...hits);
      });
    }

    const seen = new Set<string>();
    const now = new Date();

    const filtered = allHits
      .map(parseTender)
      .filter(t => {
        const id = String(t.id);
        if (seen.has(id)) return false;
        seen.add(id);
        if (!t.title || t.title === 'מכרז ללא כותרת') return false;
        if (t.deadline && new Date(String(t.deadline)) < now) return false;
        if (t.status === 'סגור') return false;
        return true;
      });

    return NextResponse.json({ tenders: filtered, total: filtered.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
