// רינדור Markdown מצומצם למסמכי האתר (מדיניות/תנאים/נגישות).
// במכוון לא ספרייה חיצונית: תת-הקבוצה שנחוצה למסמך משפטי קטנה — כותרות,
// הדגשה, רשימות, קישורים — וספרייה מלאה הייתה מוסיפה תלות ו-bundle לכל
// עמוד. אותו רנדרר משמש את העמוד הציבורי ואת ה-preview באדמין, כך
// שמה שרואים בעורך הוא בדיוק מה שיפורסם.
import React from 'react';

const DARK = '#1a2330';
const MUTED = '#5b6b7a';

// טקסט בתוך שורה: **מודגש**, *נטוי*, [קישור](https://...)
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // קישור נשלח רק ל-http/https — לא javascript: וכד'
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={`${keyBase}b${i}`}>{m[1]}</strong>);
    else if (m[2] !== undefined) out.push(<em key={`${keyBase}i${i}`}>{m[2]}</em>);
    else out.push(
      <a key={`${keyBase}a${i}`} href={m[4]} target={m[4].startsWith('/') ? undefined : '_blank'}
        rel="noopener noreferrer" style={{ color: '#1e5aa8' }}>{m[3]}</a>
    );
    last = re.lastIndex;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function renderDocMarkdown(md: string): React.ReactNode {
  const blocks: React.ReactNode[] = [];
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n');
  let para: string[] = [];
  let list: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (!para.length) return;
    blocks.push(
      <p key={key++} style={{ fontSize: '0.875rem', color: MUTED, lineHeight: 1.8, margin: '0 0 14px' }}>
        {renderInline(para.join(' '), `p${key}`)}
      </p>
    );
    para = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={key++} style={{ margin: '0 0 14px', paddingInlineStart: 22 }}>
        {list.map((item, j) => (
          <li key={j} style={{ fontSize: '0.875rem', color: MUTED, lineHeight: 1.8, marginBottom: 4 }}>
            {renderInline(item, `l${key}-${j}`)}
          </li>
        ))}
      </ul>
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line.trim());
    const li = /^[-*]\s+(.*)$/.exec(line.trim());
    if (h) {
      flushPara(); flushList();
      const level = h[1].length;
      const style: React.CSSProperties = level === 1
        ? { fontSize: '1.25rem', fontWeight: 800, color: DARK, margin: '0 0 14px' }
        : level === 2
          ? { fontSize: '1rem', fontWeight: 700, color: DARK, margin: '20px 0 8px' }
          : { fontSize: '0.90625rem', fontWeight: 700, color: DARK, margin: '16px 0 6px' };
      blocks.push(React.createElement(`h${level}`, { key: key++, style }, renderInline(h[2], `h${key}`)));
    } else if (li) {
      flushPara();
      list.push(li[1]);
    } else if (line.trim() === '') {
      flushPara(); flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara(); flushList();
  return <>{blocks}</>;
}
