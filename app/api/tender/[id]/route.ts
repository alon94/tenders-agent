import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function clean(s: string): string {
  return (s || '').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

// Find a label in the stripped-text fragments, return the next meaningful fragment after it.
function pick(frags: string[], labels: string[]): string {
  for (const label of labels) {
    for (let i = 0; i < frags.length; i++) {
      const f = frags[i].replace(/[:\s]+$/, '').trim();
      if (f === label || f === label + ':' || frags[i].trim() === label || frags[i].trim() === label + ':') {
        // look ahead for next non-colon, non-empty fragment
        for (let j = i + 1; j < Math.min(i + 4, frags.length); j++) {
          const v = frags[j].replace(/^[:\s]+/, '').trim();
          if (v && v !== ':' && v.length > 0) return clean(v);
        }
      }
    }
  }
  return '';
}

function extractDocuments(html: string): { date: string; title: string; description: string; url: string }[] {
  const strip = (s: string) =>
    s
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const blocks = html.split('winning-bidder-wrapper').slice(1);
  const seen = new Set<string>();
  const docs: { date: string; title: string; description: string; url: string }[] = [];
  for (const b of blocks) {
    const hrefM = b.match(/href="([^"]*\/p\/attachment\/[^"]*)"/);
    if (!hrefM) continue;
    let url = hrefM[1];
    if (url.startsWith('/')) url = 'https://mr.gov.il' + url;
    if (seen.has(url)) continue;
    seen.add(url);
    const dateM = b.match(/document-date[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/);
    const titleM = b.match(/document-head[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/);
    const descM = b.match(/attachment-description[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/);
    docs.push({
      date: dateM ? strip(dateM[1]) : '',
      title: titleM ? strip(titleM[1]) : '',
      description: descM ? strip(descM[1]) : '',
      url,
    });
  }
  return docs;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const sourceUrl = `https://mr.gov.il/ilgstorefront/he/p/${id}`;

  try {
    const res = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept-Language': 'he,en;q=0.9',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ id, url: sourceUrl, error: 'source fetch failed' }, { status: 200 });
    }

    const html = await res.text();

    // Build ordered list of visible text fragments
    const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
    const frags = body.replace(/<[^>]+>/g, '\n').split('\n').map((x) => clean(x)).filter((x) => x.length > 0);

    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    let title = titleMatch ? clean(titleMatch[1]) : '';
    title = title.replace(/^\d+\s*\|\s*/, '');

    const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const contactEmail = emailMatch ? emailMatch[0] : '';

    let contactName = pick(frags, ['איש קשר']);
    contactName = contactName.replace(/^איש קשר:?\s*/, '');

    const data = {
      id,
      url: sourceUrl,
      title,
      publisher: pick(frags, ['שם המפרסם']),
      publicationNumber: pick(frags, ["מס' פרסום", 'מס׳ פרסום', 'מספר פרסום']),
      status: pick(frags, ['סטטוס']),
      procedureNumber: pick(frags, ['מס׳ הליך', "מס' הליך", 'מספר הליך']),
      publishDate: pick(frags, ['תאריך פרסום']),
      updateDate: pick(frags, ['תאריך עדכון']),
      submissionStart: pick(frags, ['מועד תחילת ההגשה', 'מועד תחילת הגשה']),
      deadline: pick(frags, ['מועד אחרון להגשה']),
      contactName,
      contactEmail,
      topics: [] as string[],
      documents: extractDocuments(html) as { date: string; title: string; description: string; url: string }[],
      submissionUrl: '',
    };

    // topics: fragments after 'נושאים' until 'אולי יעניין'
    const tIdx = frags.findIndex((f) => f === 'נושאים');
    if (tIdx !== -1) {
      for (let j = tIdx + 1; j < frags.length; j++) {
        if (frags[j].includes('אולי יעניין') || frags[j] === 'אודות') break;
        if (frags[j].length < 40) data.topics.push(frags[j]);
        if (data.topics.length >= 6) break;
      }
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    return NextResponse.json({ id, url: sourceUrl, error: 'exception' }, { status: 200 });
  }
}
