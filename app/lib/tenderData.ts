export function tenderKey(t: any): string {
    return t.id || t.publication_id || ((t.title || '') + (t.publishDate || ''));
}

export async function fetchDedupedTenders() {
    const seen = new Set();
    const arr: any[] = [];
    let fetchedAt = '';
    const loadPage = async (offset: number) => {
          const r = await fetch('/api/tenders?offset=' + offset).then((res) => res.json()).catch(() => ({ tenders: [] }));
          if (r.fetchedAt) fetchedAt = r.fetchedAt;
          const batch = r.tenders || [];
          for (const t of batch) {
                  const k = tenderKey(t);
                  if (!seen.has(k)) {
                            seen.add(k);
                            arr.push(t);
                  }
          }
          if (batch.length === 1000) await loadPage(offset + 1000);
    };
    await loadPage(0);

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
