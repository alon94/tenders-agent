export function tenderKey(t: any): string {
    return t.id || t.publication_id || ((t.title || '') + (t.publishDate || ''));
}

export async function fetchDedupedTenders() {
    const seen = new Set();
    const arr: any[] = [];
    let fetchedAt = '';
    const PAGE = 1000;
    const MAX_PAGES = 20; // תקרת ביטחון: עד 20,000 מכרזים

    for (let page = 0; page < MAX_PAGES; page++) {
          const offset = page * PAGE;
          const r = await fetch('/api/tenders?offset=' + offset)
                .then((res) => res.json())
                .catch(() => ({ tenders: [] }));
          if (r.fetchedAt) fetchedAt = r.fetchedAt;
          const batch = r.tenders || [];

          let added = 0;
          for (const t of batch) {
                  const k = tenderKey(t);
                  if (!seen.has(k)) {
                            seen.add(k);
                            arr.push(t);
                            added++;
                  }
          }

          // עצירה: עמוד חלקי (הגענו לסוף), עמוד ריק, או עמוד שלא
          // הוסיף אף רשומה חדשה (הגנה מפני לולאה אינסופית אם ה-API
          // מחזיר שוב ושוב את אותו החלון).
          if (batch.length < PAGE || added === 0) break;
    }

  if (typeof window !== 'undefined') {
        try {
                const last = parseInt(localStorage.getItem('lastKnownTenderCount') || '0', 10);
                if (last > 0 && arr.length < last * 0.8) {
                          console.warn('Tender count dropped unexpectedly: was ' + last + ', now ' + arr.length + '. Check pagination / source API for issues.');
                }
                localStorage.setItem('lastKnownTenderCount', String(arr.length));
        } catch (e) {}
  }

  return { tenders: arr, fetchedAt };
}
