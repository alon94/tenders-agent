import { getValidSession, ANON_KEY, restUrl } from './authClient';

export interface BusinessProfile {
  categories: string[];
  category_other: string | null;
  region: string;
  publisher_type: string;
  /**
   * QA/M-20: מילות מפתח חופשיות מופרדות בפסיקים.
   * זהו האות החזק ביותר במנוע הניקוד (scoring.ts:98) — בסיס 25 נקודות
   * ועוד 12.5 לכל התאמה נוספת, לעומת 12+6 בלבד לקטגוריות. עד כה השדה
   * נקרא על ידי המנוע אך לא נאסף באף מסך, ולכן היה ריק אצל כל המשתמשים
   * וההתאמה רצה על חצי כוח — אף מכרז לא הגיע ל"התאמה גבוהה" (80+).
   */
  keywords: string | null;
}

// Loads the business profile row belonging to the currently logged-in user.
// Returns null if the user isn't logged in or has no profile row yet.
export async function fetchMyProfile(): Promise<BusinessProfile | null> {
  const session = await getValidSession();
  if (!session) return null;
  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${session.access_token}` };
  const base = `/business_profiles?user_id=eq.${session.user.id}&select=categories,category_other,region,publisher_type`;

  // QA/M-20: עמידות לסדר הפריסה. אם הקוד עולה לפני שרצה המיגרציה שמוסיפה
  // את עמודת keywords, PostgREST מחזיר 400 על שם עמודה לא מוכר — ואז כל
  // הפרופיל היה נראה ריק למשתמש. לכן: ניסיון עם keywords, ואם נכשל —
  // נפילה-לאחור לשליפה הישנה, כדי שהמסך ימשיך לעבוד.
  let res = await fetch(restUrl(`${base},keywords`), { headers, cache: 'no-store' });
  if (!res.ok) {
    res = await fetch(restUrl(base), { headers, cache: 'no-store' });
    if (!res.ok) return null;
    const legacy = await res.json().catch(() => []);
    return legacy?.[0] ? { ...legacy[0], keywords: null } : null;
  }
  const rows = await res.json().catch(() => []);
  return rows?.[0] || null;
}

// Creates or updates (upsert) the business profile row for the currently
// logged-in user. Requires a unique index on business_profiles.user_id.
export async function saveMyProfile(profile: Partial<BusinessProfile>): Promise<void> {
  const session = await getValidSession();
  if (!session) throw new Error('לא מחובר');
  const body: Record<string, unknown> = {
    user_id: session.user.id,
    email: session.user.email,
    ...profile,
  };
  const res = await fetch(restUrl('/business_profiles?on_conflict=user_id'), {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`שמירת הפרופיל נכשלה: ${text}`);
  }
}
