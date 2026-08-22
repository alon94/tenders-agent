"use client";
import { useCallback, useEffect, useState } from 'react';
import { getSession } from '../lib/authClient';
import { fetchMyProfile, type BusinessProfile } from '../lib/profileApi';
import { displayScore } from '../lib/scoring';
import { scoreFor } from '../lib/tenderMeta';

interface Scorable { title?: string; publisher?: string; publishDate?: string; deadline?: string }

/**
 * re-QA #04: ציון התאמה אחיד בכל הדפים. משתמש מחובר עם פרופיל עסקי רואה
 * ציון מותאם (כמו ברשימת הגילוי); אורח או משתמש בלי פרופיל — genericScore.
 */
export function useProfileScore() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  // זמן ייחוס קבוע לרינדור (ללא Date.now בזמן render — react-hooks/purity)
  const [now] = useState(() => Date.now());
  useEffect(() => {
    if (!getSession()) return;
    fetchMyProfile().then((p) => { if (p) setProfile(p); }).catch(() => {});
  }, []);
  const scoreOf = useCallback((t: Scorable): number => {
    if (profile) {
      return displayScore(
        { title: t.title || '', publisher: t.publisher || '', publishDate: t.publishDate || '', deadline: t.deadline || '' },
        { categories: profile.categories, region: profile.region, publisher_type: profile.publisher_type, keywords: profile.keywords || '' },
        now,
      );
    }
    return scoreFor(t.title || '', t.publisher || '', t.publishDate || '', t.deadline || '');
  }, [profile, now]);
  return { scoreOf, profile };
}
