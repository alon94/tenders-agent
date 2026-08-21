import { NextResponse } from "next/server";
import {
  fetchActiveTenders,
  rankTenders,
  answerQuestion,
  buildSteps,
  MATCH_THRESHOLD,
  HIGH_MATCH,
  DEFAULT_PROFILE,
  isGenericProfile,
  type AgentProfile,
} from "@/app/lib/agentEngine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ============================================================
//  /api/agent — הסוכן החכם
//  GET  — שלבי עבודה אמיתיים + התאמות מובילות לפי הפרופיל
//  POST — מענה לשאלות בשפה חופשית על בסיס המכרזים בפועל
//  הפרופיל מגיע מהלקוח (Supabase business_profiles) או מברירת מחדל.
// ============================================================

function profileFromParams(searchParams: URLSearchParams): AgentProfile {
  const categories = searchParams.get("categories");
  return {
    categories: categories ? categories.split(",").filter(Boolean) : DEFAULT_PROFILE.categories,
    region: searchParams.get("region") || DEFAULT_PROFILE.region,
    publisher_type: searchParams.get("publisher_type") || DEFAULT_PROFILE.publisher_type,
    keywords: searchParams.get("keywords") || DEFAULT_PROFILE.keywords,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const profile = profileFromParams(searchParams);

    const rows = await fetchActiveTenders();
    const ranked = rankTenders(rows, profile);
    const matched = ranked.filter((t) => t.matched);
    const high = matched.filter((t) => t.score >= HIGH_MATCH);

    const steps = buildSteps(ranked.length, matched.length, high.length, profile);
    const top = matched.slice(0, 5);

    const generic = isGenericProfile(profile);
    const messages = [
      {
        role: "agent" as const,
        text:
          generic
            ? `סרקתי ${ranked.length.toLocaleString("he-IL")} מכרזים פעילים. עדיין לא הוגדר פרופיל עסקי, לכן הדירוג כללי — לפי תחום, דחיפות וטריות. הגדרת פרופיל תשפר את ההתאמה. אפשר לשאול אותי כל שאלה:`
            : matched.length > 0
            ? `סרקתי ${ranked.length.toLocaleString("he-IL")} מכרזים פעילים ומצאתי ${matched.length} שתואמים לפרופיל שלך (${high.length} בהתאמה גבוהה). אלה המובילים — ואפשר לשאול אותי כל שאלה:`
            : `סרקתי ${ranked.length.toLocaleString("he-IL")} מכרזים פעילים אך לא נמצאו התאמות לפרופיל. נסה לעדכן את הפרופיל העסקי או לשאול אותי בחיפוש חופשי.`,
        tenders: top,
      },
    ];

    return NextResponse.json({
      status: "active",
      scanning: ranked.length,
      matched: matched.length,
      steps,
      messages,
      generic,
      // QA #07: רשימת "המתאימים ביותר" מגיעה מאותו דירוג כמו ההודעה — מקור אחד.
      top: ranked.slice(0, 10).map((t) => ({ id: t.id, title: t.title, publisher: t.publisher, deadline: t.deadline, score: t.score })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const question = String(body?.question || "").trim();
    if (!question) {
      return NextResponse.json({ error: "שאלה ריקה" }, { status: 400 });
    }
    const p = body?.profile || {};
    const profile: AgentProfile = {
      categories: Array.isArray(p.categories) && p.categories.length > 0 ? p.categories : DEFAULT_PROFILE.categories,
      region: p.region || DEFAULT_PROFILE.region,
      publisher_type: p.publisher_type || DEFAULT_PROFILE.publisher_type,
      keywords: typeof p.keywords === "string" ? p.keywords : DEFAULT_PROFILE.keywords,
    };

    const rows = await fetchActiveTenders();
    const ranked = rankTenders(rows, profile);
    const answer = answerQuestion(question, ranked);

    return NextResponse.json({
      reply: { role: "agent", text: answer.text, tenders: answer.tenders },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
