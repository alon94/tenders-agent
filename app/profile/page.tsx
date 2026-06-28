'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = [
  { id: 'tech', label: '💻 טכנולוגיה ותוכנה' },
  { id: 'consulting', label: '📊 ייעוץ וניהול' },
  { id: 'legal', label: '⚖️ משפטי ורגולציה' },
  { id: 'construction', label: '🏗️ בינוי ותשתיות' },
  { id: 'cleaning', label: '🧹 ניקיון ותחזוקה' },
  { id: 'security', label: '🛡️ שמירה ואבטחה' },
  { id: 'medical', label: '🏥 רפואה ובריאות' },
  { id: 'education', label: '🎓 חינוך והדרכה' },
  { id: 'food', label: '🍽️ מזון וקייטרינג' },
  { id: 'transport', label: '🚗 תחבורה והובלה' },
  { id: 'marketing', label: '📣 שיווק ופרסום' },
  { id: 'engineering', label: '⚙️ הנדסה וייצור' },
  { id: 'environment', label: '🌿 איכות סביבה' },
  { id: 'finance', label: '💰 פיננסים וחשבונאות' },
  { id: 'hr', label: '👥 משאבי אנוש' },
  { id: 'other', label: '📦 אחר' },
]

const REGIONS = [
  { id: 'north', label: '🟢 צפון' },
  { id: 'haifa', label: '🔵 חיפה והקריות' },
  { id: 'center', label: '🟡 מרכז (גוש דן)' },
  { id: 'tlv', label: '🟠 תל אביב' },
  { id: 'jerusalem', label: '🔴 ירושלים' },
  { id: 'south', label: '🟤 דרום' },
  { id: 'national', label: '🇮🇱 ארצי (כל הארץ)' },
]

const PUBLISHERS = [
  { id: 'gov', label: '🏛️ משרדי ממשלה' },
  { id: 'local', label: '🏙️ רשויות מקומיות' },
  { id: 'hospital', label: '🏥 בתי חולים וקופות חולים' },
  { id: 'university', label: '🎓 אוניברסיטאות ומכללות' },
  { id: 'defense', label: '🪖 ביטחון ומשטרה' },
  { id: 'infra', label: '⚡ תשתיות (חשמל, מים, תחבורה)' },
]

export default function ProfilePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState({
    businessName: '',
    categories: [] as string[],
    regions: [] as string[],
    publishers: [] as string[],
    keywords: '',
    companySize: '',
  })

  useEffect(() => {
    const saved = localStorage.getItem('tenders_profile')
    if (saved) { try { setProfile(JSON.parse(saved)) } catch {} }
  }, [])

  function toggleArr(key: 'categories' | 'regions' | 'publishers', val: string) {
    setProfile(p => {
      const arr = p[key]
      return { ...p, [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] }
    })
  }

  function save() {
    localStorage.setItem('tenders_profile', JSON.stringify(profile))
    router.push('/dashboard')
  }

  const total = 4

  return (
    <>
      <header className="topbar">
        <div className="topbar-icons">
          <div className="avatar">א</div>
        </div>
        <nav className="topbar-nav">
          <a href="/dashboard">גילוי מכרזים</a>
        </nav>
        <a href="/dashboard" className="topbar-logo">
          שווה מכרזים
          <span className="badge">מודול בתוך שווה ביזנס 360</span>
        </a>
      </header>

      <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 20px' }}>
        {/* Progress */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.82rem', color: 'var(--muted)' }}>
            <span>שלב {step} מתוך {total}</span>
            <span>{Math.round((step / total) * 100)}% הושלם</span>
          </div>
          <div style={{ background: 'var(--line)', borderRadius: 8, height: 6 }}>
            <div style={{ background: 'var(--brand)', borderRadius: 8, height: 6, width: `${(step / total) * 100}%`, transition: 'width 0.3s' }} />
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--line)', padding: '28px 32px', boxShadow: 'var(--shadow-md)' }}>

          {/* Step 1 - Business Name */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 8 }}>👋 ברוך הבא לשאלון הפרופיל</h2>
              <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: '0.9rem' }}>
                נגדיר יחד את הפרופיל העסקי שלך כדי להציג רק מכרזים רלוונטיים
              </p>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' }}>שם העסק / שם מלא</label>
                <input
                  className="search-input"
                  style={{ fontSize: '1rem', padding: '12px 16px' }}
                  placeholder="לדוגמה: חברת אלון טק בע״מ"
                  value={profile.businessName}
                  onChange={e => setProfile(p => ({ ...p, businessName: e.target.value }))}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' }}>גודל החברה</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[['solo', '👤 עצמאי'], ['small', '👥 1–10 עובדים'], ['medium', '🏢 11–50 עובדים'], ['large', '🏛️ 50+ עובדים']].map(([id, label]) => (
                    <button key={id} onClick={() => setProfile(p => ({ ...p, companySize: id }))}
                      className="filter-tab"
                      style={profile.companySize === id ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : {}}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 - Categories */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>🏷️ תחומי פעילות</h2>
              <p style={{ color: 'var(--muted)', marginBottom: 20, fontSize: '0.9rem' }}>בחר את כל התחומים שרלוונטיים לעסק שלך (ניתן לבחור מספר)</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {CATEGORIES.map(c => (
                  <button key={c.id} onClick={() => toggleArr('categories', c.id)}
                    style={{
                      padding: '10px 14px', borderRadius: 8, border: '1.5px solid',
                      borderColor: profile.categories.includes(c.id) ? 'var(--brand)' : 'var(--line)',
                      background: profile.categories.includes(c.id) ? 'var(--brand-pale)' : '#fff',
                      color: profile.categories.includes(c.id) ? 'var(--brand-dark)' : 'var(--ink)',
                      fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600,
                      cursor: 'pointer', textAlign: 'right', direction: 'rtl', transition: 'all 0.15s'
                    }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 - Regions */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>📍 אזורים גיאוגרפיים</h2>
              <p style={{ color: 'var(--muted)', marginBottom: 20, fontSize: '0.9rem' }}>באיזה אזורים אתה פעיל? (ניתן לבחור מספר)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {REGIONS.map(r => (
                  <button key={r.id} onClick={() => toggleArr('regions', r.id)}
                    style={{
                      padding: '12px 16px', borderRadius: 8, border: '1.5px solid',
                      borderColor: profile.regions.includes(r.id) ? 'var(--brand)' : 'var(--line)',
                      background: profile.regions.includes(r.id) ? 'var(--brand-pale)' : '#fff',
                      color: profile.regions.includes(r.id) ? 'var(--brand-dark)' : 'var(--ink)',
                      fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 600,
                      cursor: 'pointer', textAlign: 'right', direction: 'rtl', transition: 'all 0.15s'
                    }}>
                    {r.label}
                  </button>
                ))}
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' }}>סוגי גופים מעניינים</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {PUBLISHERS.map(p => (
                    <button key={p.id} onClick={() => toggleArr('publishers', p.id)}
                      style={{
                        padding: '9px 12px', borderRadius: 8, border: '1.5px solid',
                        borderColor: profile.publishers.includes(p.id) ? 'var(--teal)' : 'var(--line)',
                        background: profile.publishers.includes(p.id) ? 'var(--teal-pale)' : '#fff',
                        color: profile.publishers.includes(p.id) ? 'var(--teal)' : 'var(--ink)',
                        fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600,
                        cursor: 'pointer', textAlign: 'right', direction: 'rtl', transition: 'all 0.15s'
                      }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4 - Keywords */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>🔑 מילות מפתח</h2>
              <p style={{ color: 'var(--muted)', marginBottom: 20, fontSize: '0.9rem' }}>
                הוסף מילות מפתח ספציפיות שיעזרו לאתר מכרזים רלוונטיים לעסק שלך
              </p>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' }}>
                  מילות מפתח (מופרדות בפסיק)
                </label>
                <textarea
                  className="search-input"
                  style={{ height: 100, resize: 'vertical', padding: '12px 16px', fontSize: '0.9rem' }}
                  placeholder="לדוגמה: אפיון מערכות, UX, פיתוח אתרים, ניהול פרויקטים..."
                  value={profile.keywords}
                  onChange={e => setProfile(p => ({ ...p, keywords: e.target.value }))}
                />
              </div>

              {/* Summary */}
              <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: 16, fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--ink)' }}>📋 סיכום הפרופיל שלך:</div>
                {profile.businessName && <div style={{ marginBottom: 4 }}>🏢 <strong>{profile.businessName}</strong></div>}
                {profile.categories.length > 0 && <div style={{ marginBottom: 4 }}>🏷️ תחומים: {profile.categories.map(id => CATEGORIES.find(c=>c.id===id)?.label).join(', ')}</div>}
                {profile.regions.length > 0 && <div style={{ marginBottom: 4 }}>📍 אזורים: {profile.regions.map(id => REGIONS.find(r=>r.id===id)?.label).join(', ')}</div>}
                {profile.publishers.length > 0 && <div style={{ marginBottom: 4 }}>🏛️ גופים: {profile.publishers.map(id => PUBLISHERS.find(p=>p.id===id)?.label).join(', ')}</div>}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, gap: 12 }}>
            {step > 1
              ? <button className="filter-tab" onClick={() => setStep(s => s - 1)} style={{ padding: '10px 20px' }}>→ חזור</button>
              : <div />
            }
            {step < total
              ? <button className="smart-btn" onClick={() => setStep(s => s + 1)}>הבא ←</button>
              : <button className="apply-btn" style={{ width: 'auto', padding: '10px 28px' }} onClick={save}>✅ שמור ועבור לדשבורד</button>
            }
          </div>
        </div>
      </div>

      <footer className="footer">
        הפרופיל נשמר במכשיר שלך בלבד · לא מועבר לשרת
      </footer>
    </>
  )
}
