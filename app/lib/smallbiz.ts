// ============================================================
//  smallbiz — זיהוי "העדפה לעסקים קטנים" בחוברות מכרז
//
//  תהליך 2 בארכיטקטורה (ראה docs/ARCHITECTURE.md):
//  batch יומי שמוריד את מסמכי המכרז, מחלץ טקסט, ומזהה העדפה
//  בשתי שכבות: ביטויי מפתח (חינם) + אימות LLM (Claude Haiku).
//  כותב אך ורק לשדות small_biz_* — לעולם לא לשדות הבסיס.
// ============================================================

import { TenderRecord } from './db';

// --- שכבה א': ביטויי מפתח ---
const KEY_PHRASES = [
  'עסק קטן',
  'עסקים קטנים',
  'עסקים קטנים ובינוניים',
  'עסקים זעירים',
  'העדפת עסקים',
  'העדפה לעסקים',
  'תקנה 15א',
  'עידוד עסקים קטנים',
  'משקל מתקן לעסקים',
];

export interface SmallBizResult {
  small_biz: boolean | null;
  small_biz_summary: string | null;
  small_biz_quote: string | null;
  small_biz_confidence: 'high' | 'medium' | 'low' | null;
}

// חילוץ קטעי הקשר סביב פגיעות ביטויי המפתח
export function findKeywordExcerpts(text: string, contextChars = 400, maxExcerpts = 3): string[] {
  const clean = text.replace(/\s+/g, ' ');
  const excerpts: string[] = [];
  for (const phrase of KEY_PHRASES) {
    let idx = clean.indexOf(phrase);
    while (idx !== -1 && excerpts.length < maxExcerpts) {
      const start = Math.max(0, idx - contextChars / 2);
      const end = Math.min(clean.length, idx + phrase.length + contextChars / 2);
      const ex = clean.slice(start, end);
      if (!excerpts.some((e) => e.includes(phrase) && e.slice(0, 50) === ex.slice(0, 50))) {
        excerpts.push(ex);
      }
      idx = clean.indexOf(phrase, idx + 1);
    }
    if (excerpts.length >= maxExcerpts) break;
  }
  return excerpts;
}

// --- שכבה ב': אימות Claude Haiku (JSON מובנה) ---
async function verifyWithLLM(tenderTitle: string, excerpts: string[]): Promise<SmallBizResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = `אתה בודק חוברות מכרז ממשלתיות. להלן קטעים מחוברת המכרז "${tenderTitle}" שבהם מופיעים ביטויים הקשורים לעסקים קטנים.

קבע: האם המכרז מעניק העדפה ממשית לעסקים קטנים/בינוניים (למשל ניקוד עודף, משקל מתקן לפי תקנה 15א, שריון), או שזה אזכור אגבי בלבד?

השב ב-JSON בלבד, בפורמט:
{"preference": true/false, "summary": "סיכום בעברית עד 20 מילים", "quote": "ציטוט קצר ומדויק מהטקסט", "confidence": "high"/"medium"/"low"}

הקטעים:
${excerpts.map((e, i) => `--- קטע ${i + 1} ---\n${e}`).join('\n')}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const textOut: string = data?.content?.[0]?.text || '';
    const jsonMatch = textOut.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      small_biz: !!parsed.preference,
      small_biz_summary: String(parsed.summary || '').slice(0, 300) || null,
      small_biz_quote: String(parsed.quote || '').slice(0, 500) || null,
      small_biz_confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
    };
  } catch {
    return null;
  }
}

// --- סיווג מלא של טקסט חוברת ---
export async function classifySmallBiz(tenderTitle: string, pdfText: string): Promise<SmallBizResult> {
  if (!pdfText || pdfText.trim().length < 100) {
    // אין טקסט (כנראה מסמך סרוק) — מסומן כלא-ניתן-לבדיקה
    return { small_biz: null, small_biz_summary: 'לא חולץ טקסט מהמסמך (ייתכן שסרוק)', small_biz_quote: null, small_biz_confidence: null };
  }

  const excerpts = findKeywordExcerpts(pdfText);
  if (excerpts.length === 0) {
    return { small_biz: false, small_biz_summary: null, small_biz_quote: null, small_biz_confidence: 'high' };
  }

  // שכבה ב' — אימות LLM; נסיגה לסיווג מבוסס-ביטויים אם אין מפתח/כשל
  const llm = await verifyWithLLM(tenderTitle, excerpts);
  if (llm) return llm;

  return {
    small_biz: true,
    small_biz_summary: 'נמצאו ביטויי העדפה לעסקים קטנים בחוברת (ללא אימות LLM)',
    small_biz_quote: excerpts[0].slice(0, 300),
    small_biz_confidence: 'medium',
  };
}

// --- איתור והורדת מסמכי המכרז מ-mr.gov.il ---
export async function fetchTenderPdfText(publicationId: string): Promise<string> {
  const pageRes = await fetch(`https://mr.gov.il/ilgstorefront/he/p/${publicationId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept-Language': 'he',
    },
    cache: 'no-store',
  });
  if (!pageRes.ok) return '';
  const html = await pageRes.text();

  // קישורי מסמכים (attachments)
  const urls = [...html.matchAll(/href="([^"]*\/p\/attachment\/[^"]*)"/g)]
    .map((m) => (m[1].startsWith('/') ? 'https://mr.gov.il' + m[1] : m[1]))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 2); // עד 2 מסמכים למכרז — שמירה על תקציב זמן

  let combined = '';
  for (const url of urls) {
    try {
      const docRes = await fetch(url, { cache: 'no-store' });
      if (!docRes.ok) continue;
      const ctype = docRes.headers.get('content-type') || '';
      const buf = Buffer.from(await docRes.arrayBuffer());
      if (buf.length > 15 * 1024 * 1024) continue; // דילוג על קבצים ענקיים
      if (ctype.includes('pdf') || buf.subarray(0, 4).toString() === '%PDF') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse/lib/pdf-parse.js');
        const parsed = await pdfParse(buf).catch(() => null);
        if (parsed?.text) combined += '\n' + parsed.text;
      }
      if (combined.length > 200000) break;
    } catch { /* מסמך בודד שנכשל לא עוצר את התהליך */ }
  }
  return combined;
}

export type { TenderRecord };
