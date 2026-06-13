'use client';

import { useEffect, useState } from 'react';
import type { Tender } from '../types';

function daysLeft(deadline: string | null): number | null {
    if (!deadline) return null;
    const diff = new Date(deadline).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatBudget(n: number | null): string {
    if (!n) return '';
    if (n >= 1_000_000) return `₪${(n / 1_000_000).toFixed(1)}מ`;
    if (n >= 1_000) return `₪${(n / 1_000).toFixed(0)}אלף`;
    return `₪${n}`;
}

function UrgencyBadge({ days }: { days: number | null }) {
    if (days === null) return null;
    if (days <= 7) return <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">דחוף! {days} ימים</span>;
    if (days <= 14) return <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full">{days} ימים</span>;
    return <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">{days} ימים</span>;
}

export default function DashboardPage() {
    const [tenders, setTenders] = useState<Tender[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
          fetch('/api/tenders?limit=20')
                  .then(r => r.json())
                  .then(data => {
                            setTenders(data.tenders ?? []);
                            if (data.note) setNote(data.note);
                  })
                  .catch(() => setError('לא ניתן לטעון מכרזים ברגע זה'))
                  .finally(() => setLoading(false));
    }, []);

    const filtered = tenders.filter(t =>
                                        !filter ||
                                        t.title.includes(filter) ||
                                        t.category.includes(filter) ||
                                        t.publisher.includes(filter) ||
                                        t.region.includes(filter)
                                      );

    return (
          <main className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
            <header className="bg-indigo-700 text-white px-6 py-4 flex items-center justify-between shadow">
              <h1 className="text-xl font-bold">🏆 סוכן מכרזים</h1>
              <span className="text-indigo-200 text-sm">{tenders.length} מכרזים נמצאו</span>
            </header>

            <div className="max-w-4xl mx-auto p-6">
      {/* Demo note */}
      {note && (
                  <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-xl">
                    ⚠️ {note}
                  </div>
                )}

      {/* Search */}
              <div className="mb-6">
                <input
                  type="text"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  placeholder="חפש לפי כותרת, תחום או מפרסם..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-right shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

      {/* States */}
      {loading && (
                  <div className="text-center py-20 text-gray-400">
                    <div className="text-4xl mb-3">🔄</div>
                    <p>שואב מכרזים...</p>
                  </div>
                )}

      {error && (
                  <div className="text-center py-20 text-red-500">
                    <div className="text-4xl mb-3">⚠️</div>
                    <p>{error}</p>
                  </div>
                )}

      {/* Tender Cards */}
      {!loading && !error && (
                  <div className="space-y-4">
        {filtered.length === 0 ? (
                        <p className="text-center text-gray-400 py-12">לא נמצאו תוצאות</p>
                      ) : filtered.map(tender => {
                        const days = daysLeft(tender.deadline);
                        return (
                                          <div key={tender.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between gap-4">
                                              <div className="flex-1 min-w-0">
                                                <h2 className="font-bold text-gray-900 text-lg leading-snug mb-1 truncate">{tender.title}</h2>
                                                <p className="text-sm text-indigo-600 font-medium mb-2">{tender.publisher}</p>
                          {tender.description && tender.description !== tender.title && (
                                                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">{tender.description}</p>
                                                  )}
                                                <div className="flex flex-wrap gap-2 items-center">
                                                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{tender.category}</span>
                                                  <span className="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded-full">📍 {tender.region}</span>
                          {tender.budget && (
                                                      <span className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded-full">💰 {formatBudget(tender.budget)}</span>
                                                    )}
                                                  <UrgencyBadge days={days} />
                                                </div>
                                              </div>
                                              <a
                                                href={tender.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
                                              >
                                                צפייה →
                                              </a>
                                            </div>
                                          </div>
                                        );
        })}
                  </div>
                )}
            </div>
          </main>
        );
}
