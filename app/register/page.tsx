'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CATEGORIES = [
    'בנייה ותשתיות', 'טכנולוגיה ותוכנה', 'יעוץ ושירותים מקצועיים',
    'נקיון ותחזוקה', 'חינוך והכשרות', 'בריאות ורפואה',
    'שירותי אבטחה', 'ספק מזון וקייטרינג', 'תקשורת ומדיה',
    'סביבה ואנרגיה', 'עיצוב ושיקוע', 'אחר'
  ];

const REGIONS = [
    'כל הארץ', 'מרכז - תל אביב', 'צפון', 'דרום',
    'ירושלים והסביבה', 'חיפה והקריות'
  ];

export default function RegisterPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
          businessName: '',
          ownerName: '',
          email: '',
          phone: '',
          category: '',
          region: '',
          employees: '',
          notification: 'whatsapp',
    });

  const update = (field: string, value: string) =>
        setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
        setLoading(true);
        try {
                const res = await fetch('/api/register', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(form),
                });
                if (res.ok) {
                          router.push('/dashboard');
                }
        } finally {
                setLoading(false);
        }
  };

  return (
        <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6" dir="rtl">
              <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-lg">
                {/* Progress */}
                      <div className="flex gap-2 mb-8">
                        {[1, 2, 3].map(s => (
                      <div key={s} className={`h-2 flex-1 rounded-full ${
                                      s <= step ? 'bg-indigo-600' : 'bg-gray-200'
                      }`} />
                    ))}
                      </div>div>
              
                {step === 1 && (
                    <div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-6">פרטי העסק</h2>h2>
                                <div className="space-y-4">
                                              <div>
                                                              <label className="block text-sm font-medium text-gray-700 mb-1">שם העסק *</label>label>
                                                              <input
                                                                                  type="text"
                                                                                  value={form.businessName}
                                                                                  onChange={e => update('businessName', e.target.value)}
                                                                                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                                                  placeholder="לדוגמא: חברת טכנולוגיה בעמ""
                                                              />
                                              </div>div>
                                              <div>
                                                              <label className="block text-sm font-medium text-gray-700 mb-1">שם הבעלים *</label>label>
                                                              <input
                                                                                  type="text"
                                                                                  value={form.ownerName}
                                                                                  onChange={e => update('ownerName', e.target.value)}
                                                                                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                                                  placeholder="שם מלא""
                                                              />
                                              </div>div>
                                              <div>
                                                              <label className="block text-sm font-medium text-gray-700 mb-1">מייל *</label>label>
                                                              <input
                                                                                  type="email"
                                                                                  value={form.email}
                                                                                  onChange={e => update('email', e.target.value)}
                                                                                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                                                  placeholder="email@example.com"
                                                                                />
                                              </div>div>
                                              <div>
                                                              <label className="block text-sm font-medium text-gray-700 mb-1">טלפון *</label>label>
                                                              <input
                                                                                  type="tel"
                                                                                  value={form.phone}
                                                                                  onChange={e => update('phone', e.target.value)}
                                                                                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                                                  placeholder="05X-XXXXXXX"
                                                                                />
                                              </div>div>
                                </div>div>
                                <button
                                                onClick={() => setStep(2)}
                                                disabled={!form.businessName || !form.email || !form.phone}
                                                className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors"
                                              >
                                              המשך →
                                </button>button>
                    </div>div>
                      )}
              
                {step === 2 && (
                    <div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-6">פרופיל עסקי</h2>h2>
                                <div className="space-y-4">
                                              <div>
                                                              <label className="block text-sm font-medium text-gray-700 mb-1">תחום עיסקי *</label>label>
                                                              <select
                                                                                  value={form.category}
                                                                                  onChange={e => update('category', e.target.value)}
                                                                                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                                                >
                                                                                <option value="">בחר תחום...</option>option>
                                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>option>)}
                                                              </select>select>
                                              </div>div>
                                              <div>
                                                              <label className="block text-sm font-medium text-gray-700 mb-1">אזור גיאוגרפי *</label>label>
                                                              <select
                                                                                  value={form.region}
                                                                                  onChange={e => update('region', e.target.value)}
                                                                                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                                                >
                                                                                <option value="">בחר אזור...</option>option>
                                                                {REGIONS.map(r => <option key={r} value={r}>{r}</option>option>)}
                                                              </select>select>
                                              </div>div>
                                              <div>
                                                              <label className="block text-sm font-medium text-gray-700 mb-1">מספר עובדים</label>label>
                                                              <select
                                                                                  value={form.employees}
                                                                                  onChange={e => update('employees', e.target.value)}
                                                                                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                                                >
                                                                                <option value="">בחר...</option>option>
                                                                                <option value="1">עצמאי / 1 עובד</option>option>
                                                                                <option value="2-5">2-5</option>option>
                                                                                <option value="6-20">6-20</option>option>
                                                                                <option value="21-50">21-50</option>option>
                                                                                <option value="50+">מעל 50</option>option>
                                                              </select>select>
                                              </div>div>
                                </div>div>
                                <div className="flex gap-3 mt-6">
                                              <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 text-gray-700 font-bold py-3 rounded-xl">חזרה</button>button>
                                              <button
                                                                onClick={() => setStep(3)}
                                                                disabled={!form.category || !form.region}
                                                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors"
                                                              >
                                                              המשך →
                                              </button>button>
                                </div>div>
                    </div>div>
                      )}
              
                {step === 3 && (
                    <div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">איך לשלוח אליך מכרזים?</h2>h2>
                                <p className="text-gray-500 mb-6">קבל עדכונים יומיים בסוף כל יום עסקי</p>p>
                                <div className="space-y-3 mb-6">
                                  {[{id:'whatsapp',label:'📱 וואטסאפ (מומלץ)'},{id:'email',label:'📧 אימייל'},{id:'both',label:'📬 שניהם'}].map(opt => (
                                      <label key={opt.id} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer ${
                                                          form.notification === opt.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                                      }`}>
                                                        <input
                                                                              type="radio"
                                                                              name="notification"
                                                                              value={opt.id}
                                                                              checked={form.notification === opt.id}
                                                                              onChange={e => update('notification', e.target.value)}
                                                                              className="accent-indigo-600"
                                                                            />
                                                        <span className="font-medium">{opt.label}</span>span>
                                      </label>label>
                                    ))}
                                </div>div>
                                <div className="flex gap-3">
                                              <button onClick={() => setStep(2)} className="flex-1 border border-gray-300 text-gray-700 font-bold py-3 rounded-xl">חזרה</button>button>
                                              <button
                                                                onClick={handleSubmit}
                                                                disabled={loading}
                                                                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors"
                                                              >
                                                {loading ? 'שולח...' : 'התחל! ✨'}
                                              </button>button>
                                </div>div>
                    </div>div>
                      )}
              </div>div>
        </main>main>
      );
}</main>
