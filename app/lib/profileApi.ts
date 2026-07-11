import { getValidSession, ANON_KEY, restUrl } from './authClient';

export interface BusinessProfile {
  categories: string[];
  category_other: string | null;
  region: string;
  publisher_type: string;
}

// Loads the business profile row belonging to the currently logged-in user.
// Returns null if the user isn't logged in or has no profile row yet.
export async function fetchMyProfile(): Promise<BusinessProfile | null> {
  const session = await getValidSession();
  if (!session) return null;
  const res = await fetch(
    restUrl(
      `/business_profiles?user_id=eq.${session.user.id}&select=categories,category_other,region,publisher_type`
    ),
    {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    }
  );
  if (!res.ok) return null;
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
