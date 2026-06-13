import { NextRequest, NextResponse } from 'next/server';

const BUDGETKEY_API = 'https://next.obudget.org/api/search';
import type { Tender } from '../../types';

function parseTender(raw: Record<string, unknown>): Tender {
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
          url: doc.url ? String(doc.url) : `https://www.mr.gov.il/`,
          publishDate: String(doc.start_date ?? doc.date_updated ?? new Date().toISOString()),
          status: String(doc.tender_type ?? 'פתוח'),
        };
  }

export async function GET(req: NextRequest) {
    try {
          const { searchParams } = new URL(req.url);
          const category = searchParams.get('category') ?? '';
          const region = searchParams.get('region') ?? '';
          const limit = parseInt(searchParams.get('limit') ?? '20');

          // Build search query for BudgetKey
          let query = 'kind:tender ';
          if (category) query += `${category} `;
          if (region && region !== 'כל הארץ') query += `${region} `;

          const params = new URLSearchParams({
                  q: query.trim(),
                  size: String(limit),
                  from: '0',
                  kind: 'tender',
                });

          const apiUrl = `${BUDGETKEY_API}?${params}`;

          const response = await fetch(apiUrl, {
                  headers: { 'Accept': 'application/json' },
                  next: { revalidate: 3600 }, // Cache 1 hour
                });

          if (!response.ok) {
                  throw new Error(`BudgetKey API error: ${response.status}`);
                }

          const data = await response.json();

          // BudgetKey returns { search_results: [...] } or { hits: { hits: [...] } }
          const rawResults: Record<string, unknown>[] =
            data?.search_results ??
            data?.hits?.hits ??
            [];

          const tenders: Tender[] = rawResults
            .map(parseTender)
            .filter(t => t.title !== 'מכרז ללא כותרת' || rawResults.length === 0);

          return NextResponse.json({
                  success: true,
                  count: tenders.length,
                  tenders,
                  fetchedAt: new Date().toISOString(),
                });

        } catch (error) {
          console.error('שגיאה בשאיבת מכרזים:', error);

          // Return mock data if API fails (for development/demo)
                                                const mockTenders: Tender[] = [
                                                        {
                                                                  id: 'mock-1',
                                                                  title: 'מתן שירותים מקצועיים לפיתוח מערכות מידע',
                                                                  publisher: 'משרד הבריאות',
                                                                  category: 'טכנולוגיה',
                                                                  region: 'כל הארץ',
                                                                  deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                                                                  budget: 500000,
                                                                  description: 'פיתוח מערכת מידע משולבת לניהול מידע קליני',
                                                                  url: 'https://www.mr.gov.il/',
                                                                  publishDate: new Date().toISOString(),
                                                                  status: 'פתוח',
                                                                },
                                                        {
                                                                  id: 'mock-2',
                                                                  title: 'נקיון בנייני משרד החינוך בירושלים',
                                                                  publisher: 'משרד החינוך',
                                                                  category: 'נקיון ותחזוקה',
                                                                  region: 'ירושלים',
                                                                  deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                                                                  budget: 120000,
                                                                  description: 'שירותי נקיון שוטפיים ותחזוקה שוטפת לבנייני המשרד',
                                                                  url: 'https://www.mr.gov.il/',
                                                                  publishDate: new Date().toISOString(),
                                                                  status: 'פתוח',
                                                                },
                                                        {
                                                                  id: 'mock-3',
                                                                  title: 'אספקת מזון למוסדות חינוכיות בגליל',
                                                                  publisher: 'רשות מקומית צפון',
                                                                  category: 'ספק מזון',
                                                                  region: 'צפון',
                                                                  deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                                                                  budget: 200000,
                                                                  description: 'אספקת ארוחות צהריים לתלמידים בבתי ספר באזור הצפון',
                                                                  url: 'https://www.mr.gov.il/',
                                                                  publishDate: new Date().toISOString(),
                                                                  status: 'פתוח',
                                                                },
                                                      ];

                                                return NextResponse.json({
                                                        success: true,
                                                        count: mockTenders.length,
                                                        tenders: mockTenders,
                                                        fetchedAt: new Date().toISOString(),
                                                        note: 'נתוני דוגמא - ה-API החיצוני אינו זמין כרגע',
                                                      });
                                              }
                                            }
