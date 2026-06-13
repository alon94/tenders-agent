'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type FormData = {
  businessName: string; ownerName: string; email: string; phone: string;
  category: string; region: string; employees: string; notification: string;
};

const L = {
  step1Title: 'פרטי עסק',
  step2Title: 'פרופיל עסקי',
  step3Title: 'עדכונים',
  businessName: 'שם עסק',
  ownerName: 'שם בעלים',
  email: 'אימייל',
  phone: 'טלפון',
  category: 'ספיקת עסק',
  region: 'אזור',
  next: 'המשך',
  back: 'חזרה',
  register: 'הירשם',
  saving: 'שומר...',
  selectPlaceholder: 'בחר...',
  whatsapp: 'WhatsApp',
  emailNotif: 'אימייל',
  both: 'שניהם',
};

const cats = [
  'טכנולוגיה',
  'בנייה',
  'בריאות',
  'חינוך',
  'ניקיון ותחזוקה',
  'מזון',
  'בטיחות',
  'סביבה',
  'אחר',
];
const regs = [
  'כל הארץ',
  'צפון',
  'מרכז',
  'דרום',
  'ירושלים',
  'חיפה',
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>({
    businessName: '', ownerName: '', email: '', phone: '',
    category: '', region: '', employees: '', notification: 'whatsapp',
  });
  const upd = (f: keyof FormData, v: string) => setForm((p) => ({ ...p, [f]: v }));
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) router.push('/dashboard');
      else { const d = await res.json(); alert(d.error || 'Error'); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="flex justify-between mb-8">
          {[1,2,3].map((n) => (
            <div key={n} className={'flex-1 h-2 rounded-full mx-1 ' + (step >= n ? 'bg-indigo-600' : 'bg-gray-200')} />
          ))}
        </div>
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-6">{L.step1Title}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.businessName}</label>
              <input type="text" value={form.businessName} onChange={(e) => upd('businessName', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.ownerName}</label>
              <input type="text" value={form.ownerName} onChange={(e) => upd('ownerName', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.email}</label>
              <input type="email" value={form.email} onChange={(e) => upd('email', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.phone}</label>
              <input type="tel" value={form.phone} onChange={(e) => upd('phone', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <button onClick={() => setStep(2)} disabled={!form.businessName || !form.email || !form.phone}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl">{L.next}</button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-6">{L.step2Title}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.category}</label>
              <select value={form.category} onChange={(e) => upd('category', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3">
                <option value="">{L.selectPlaceholder}</option>
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.region}</label>
              <select value={form.region} onChange={(e) => upd('region', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3">
                <option value="">{L.selectPlaceholder}</option>
                {regs.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 text-gray-600 font-bold py-3 rounded-xl">{L.back}</button>
              <button onClick={() => setStep(3)} disabled={!form.category || !form.region}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl">{L.next}</button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-6">{L.step3Title}</h2>
            {[{ v: 'whatsapp', l: L.whatsapp }, { v: 'email', l: L.emailNotif }, { v: 'both', l: L.both }].map(({ v, l }) => (
              <label key={v} className={'flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer ' + (form.notification === v ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200')}>
                <input type="radio" name="notification" value={v} checked={form.notification === v} onChange={() => upd('notification', v)} className="sr-only" />
                <span className="font-medium">{l}</span>
              </label>
            ))}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(2)} className="flex-1 border border-gray-300 text-gray-600 font-bold py-3 rounded-xl">{L.back}</button>
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl">
                {loading ? L.saving : L.register}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
