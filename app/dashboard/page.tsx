'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Tender { id: string; title: string; publisher: string; publishDate: string; deadline: string; status: string; url: string; type?: string }
interface Profile { businessName?: string; categories?: string[]; regions?: string[]; publishers?: string[]; keywords?: string }

const CAT_KW: Record<string,string[]> = {
  tech:['טכנולוגי','תוכנה','מחשב','דיגיטל','סייבר','פיתוח','אפליקצי','מערכת','IT','ענן','בינה מלאכותית'],
  consulting:['ייעוץ','ניהול','אסטרטגי','כלכל','פרויקט','תכנון'],
  legal:['משפט','רגולצי','עו"ד','ייצוג','חוזה'],
  construction:['בניה','תשתית','עבודות','קבלן','שיפוץ','אדריכל'],
  cleaning:['ניקיון','תחזוקה','חיטוי'],
  security:['שמירה','אבטחה','מאבטח','בטיחות'],
  medical:['רפואי','בריאות','רפואה','תרופ','מכשור רפואי'],
  education:['חינוך','הכשרה','הדרכה','קורס','אקדמי'],
  food:['מזון','קייטרינג','אוכל','כשר'],
  transport:['הובלה','תחבורה','רכב','לוגיסטי','הסעות'],
  marketing:['שיווק','פרסום','מיתוג','יחסי ציבור','קמפיין'],
  engineering:['הנדסה','ייצור','תעשיה','אלקטרוניקה','חשמל'],
  environment:['סביבה','קיימות','פסולת','מחזור','אנרגיה ירוקה'],
  finance:['חשבונאות','ביקורת','פיננסי','מס','ביטוח'],
  hr:['משאבי אנוש','גיוס','שכר','רווחה'],
}
const REG_KW: Record<string,string[]> = {
  north:['צפון','עכו','נצרת','טבריה','קריית שמונה','גליל'],
  haifa:['חיפה','קריות','קריית','נשר','קרמל'],
  center:['מרכז','פתח תקווה','ראשון לציון','רחובות','רמת גן','גבעתיים','בני ברק','חולון','בת ים'],
  tlv:['תל אביב','תל-אביב','יפו'],
  jerusalem:['ירושלים','בית שמש','מודיעין'],
  south:['דרום','באר שבע','אשדוד','אשקלון','נגב','אילת'],
  national:[],
}
const PUB_KW: Record<string,string[]> = {
  gov:['משרד','ממשלה','מדינה','רשות','מינהל'],
  local:['עירייה','מועצה','רשות מקומית','אזורית'],
  hospital:['בית חולים','קופת חולים','מאוחדת','כללית','מכבי','לאומית'],
  university:['אוניברסיטה','מכללה','טכניון'],
  defense:['צבא','משטרה','ביטחון'],
  infra:['חשמל','מים','נתיבי','מקורות'],
}

function scoreMatch(t: Tender, profile: Profile): number {
  let score = 0
  const text = (t.title + ' ' + t.publisher).toLowerCase()
  const kw = (profile.keywords || '').split(',').map(k => k.trim()).filter(Boolean)
  kw.forEach(k => { if (text.includes(k.toLowerCase())) score += 10 })
  ;(profile.categories || []).forEach(cat => { CAT_KW[cat]?.forEach(w => { if (text.includes(w.toLowerCase())) score += 5 }) })
  if ((profile.regions || []).includes('national')) score += 1
  ;(profile.regions || []).filter(r => r !== 'national').forEach(reg => { REG_KW[reg]?.forEach(w => { if (text.includes(w.toLowerCase())) score += 3 }) })
  ;(profile.publishers || []).forEach(pub => { PUB_KW[pub]?.forEach(w => { if (text.includes(w.toLowerCase())) score += 4 }) })
  return score
}

function formatDate(d: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit', year:'numeric' }) } catch { return d }
}
function daysLeft(deadline: string) {
  if (!deadline) return null
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
}

export default function Dashboard() {
  const [tenders, setTenders] = useState<Tender[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMsg, setLoadingMsg] = useState('טוען מכרזים...')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [lastUpdate, setLastUpdate] = useState('')
  const [profile, setProfile] = useState<Profile>({})

  useEffect(() => {
    const saved = localStorage.getItem('tenders_profile')
    if (saved) { try { setProfile(JSON.parse(saved)) } catch {} }
  }, [])

  const load = useCallback(async (q = '') => {
    setLoading(true); setError(''); setTenders([])
    setLoadingMsg('טוען מכרזים...')
    try {
      const qs = q ? '&q=' + encodeURIComponent(q) : ''
      const [r0,r1,r2,r3] = await Promise.all([
        fetch('/api/tenders?offset=0'+qs).then(r=>r.json()),
        fetch('/api/tenders?offset=1000'+qs).then(r=>r.json()),
        fetch('/api/tenders?offset=2000'+qs).then(r=>r.json()),
        fetch('/api/tenders?offset=3000'+qs).then(r=>r.json()),
      ])
      const seen = new Set<string>()
      const all: Tender[] = [...(r0.tenders||[]),...(r1.tenders||[]),...(r2.tenders||[]),...(r3.tenders||[])]
        .filter(t => { if (!t.title||seen.has(t.id)) return false; seen.add(t.id); return true })
      setTenders(all)
      setLastUpdate(new Date().toLocaleTimeString('he-IL'))
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'שגיאה') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const matchedTenders = tenders
    .map(t => ({ ...t, score: scoreMatch(t, profile) }))
    .filter(t => t.score > 0)
    .sort((a,b) => b.score - a.score)

  const filtered = (activeTab === 'match' ? matchedTenders : tenders).filter(t => {
    const q = search.toLowerCase()
    const ok = !q || t.title?.toLowerCase().includes(q) || t.publisher?.toLowerCase().includes(q)
    if (activeTab === 'closing') { const d = daysLeft(t.deadline); return ok && d !== null && d >= 0 && d <= 7 }
    if (activeTab === 'new') { if (!t.publishDate) return false; return ok && Math.ceil((Date.now()-new Date(t.publishDate).getTime())/86400000) <= 7 }
    if (activeTab === 'tech') return ok && (t.title.includes('טכנולוג')||t.title.includes('תוכנה')||t.title.includes('מחשב'))
    return ok
  })

  const closing7 = tenders.filter(t => { const d=daysLeft(t.deadline); return d!==null&&d>=0&&d<=7 }).length
  const newLast7 = tenders.filter(t => { if(!t.publishDate) return false; return Math.ceil((Date.now()-new Date(t.publishDate).getTime())/86400000)<=7 }).length
  const hasProfile = !!(profile.categories?.length || profile.keywords)

  const TAB = (id:string,label:string,count:number,color='var(--brand)') => (
    <button className="filter-tab"
      style={activeTab===id?{background:color,color:'#fff',borderColor:color}:{}}
      onClick={()=>setActiveTab(id)}>
      {label} ({count.toLocaleString()})
    </button>
  )

  return (
    <>
      <header className="topbar">
        <div className="topbar-icons">
          <Link href="/profile"><div className="avatar" title="פרופיל">{profile.businessName?profile.businessName[0]:'א'}</div></Link>
          <button className="icon-btn">🔔</button>
        </div>
        <nav className="topbar-nav">
          <a href="#">מקורות</a><a href="#">AgentOS</a><a href="#">ערביות וליווי</a>
          <a href="#">התראות</a><a href="#">הגשות שלי</a>
          <a href="/dashboard" className="active">גילוי מכרזים</a>
        </nav>
        <a href="/dashboard" className="topbar-logo">שווה מכרזים<span className="badge">מודול בתוך שווה ביזנס 360</span></a>
      </header>

      <div className="status-bar">
        <span className="status-dot" />
        <span>סריקה: <strong>{loading?'...':tenders.length.toLocaleString()}</strong> מכרזים · <a href="https://next.obudget.org" target="_blank" rel="noopener noreferrer">data.gov.il</a></span>
        {lastUpdate && <span>· עודכן: {lastUpdate}</span>}
        {profile.businessName && <span>· 👤 {profile.businessName}</span>}
        <button className="refresh-btn" onClick={()=>load(search)} disabled={loading}>{loading?loadingMsg:'רענון'}</button>
      </div>

      <div className="page-wrap">
        <main>
          <div className="stats-row">
            <div className="stat-card"><div className="stat-num ink">{loading?'…':tenders.length.toLocaleString()}</div><div className="stat-label">מכרזים פעילים במאגר</div></div>
            <div className="stat-card"><div className="stat-num brand">{loading?'…':matchedTenders.length.toLocaleString()}</div><div className="stat-label">התאמות לפרופיל שלך</div></div>
            <div className="stat-card"><div className="stat-num teal">{loading?'…':closing7}</div><div className="stat-label">נסגרים בשבוע הקרוב</div></div>
            <div className="stat-card"><div className="stat-num amber">{loading?'…':newLast7}</div><div className="stat-label">חדשים ב-7 ימים</div></div>
          </div>

          {!hasProfile && !loading && (
            <div style={{background:'var(--brand-pale)',border:'1.5px solid var(--brand)',borderRadius:'var(--radius)',padding:'14px 20px',marginBottom:14,display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:'1.3rem'}}>👤</span>
              <div style={{flex:1,fontSize:'0.9rem'}}><strong>טרם הגדרת פרופיל עסקי</strong> — הגדר פרופיל לקבל מכרזים מותאמים אישית</div>
              <Link href="/profile"><button className="smart-btn">הגדר פרופיל ←</button></Link>
            </div>
          )}

          <div className="search-area">
            <div className="search-row">
              <div className="search-input-wrap">
                <input className="search-input" placeholder="חיפוש: נושא, גוף מפרסם, מספר מכרז..."
                  value={search} onChange={e=>setSearch(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&load(search)} />
                <span className="search-icon">🔍</span>
              </div>
              <button className="smart-btn" onClick={()=>load(search)}>חיפוש</button>
            </div>
            <div className="filter-tabs">
              {TAB('all','📋 כל המכרזים',tenders.length)}
              {TAB('match','⭐ התאמות לפרופיל',matchedTenders.length,'var(--teal)')}
              {TAB('closing','🚨 נסגרים השבוע',closing7,'var(--red)')}
              {TAB('new','✨ חדשים',newLast7,'var(--teal)')}
              {TAB('tech','💻 טכנולוגיה',tenders.filter(t=>t.title.includes('טכנולוג')||t.title.includes('תוכנה')).length)}
            </div>
          </div>

          {loading && <div className="loading-state"><div className="spinner"/><div>{loadingMsg}</div></div>}
          {error && <div className="error-state">⚠️ {error}</div>}
          {!loading && !error && (
            <div className="tender-list">
              {filtered.length===0 && (
                <div className="loading-state">
                  {activeTab==='match'&&!hasProfile
                    ? <><div style={{marginBottom:12}}>הגדר פרופיל עסקי כדי לראות התאמות</div><Link href="/profile"><button className="smart-btn">הגדר פרופיל ←</button></Link></>
                    : 'לא נמצאו מכרזים תואמים'}
                </div>
              )}
              {filtered.map(t => {
                const days = daysLeft(t.deadline)
                const soon = days!==null&&days>=0&&days<=7
                const score = (t as Tender&{score?:number}).score
                return (
                  <div className="tender-card" key={t.id}>
                    <div className="tender-card-top">
                      <div className="tender-title">
                        {t.url ? <a href={t.url} target="_blank" rel="noopener noreferrer">{t.title}</a> : t.title}
                      </div>
                      <div className="tender-tags">
                        {activeTab==='match'&&score&&score>0&&<span className="tag" style={{background:'#FEF3C7',color:'#92400E'}}>⭐{score>15?'גבוהה':score>8?'טובה':'התאמה'}</span>}
                        {soon&&<span className="tag tag-closing">🚨 נסגר בקרוב</span>}
                        {!soon&&t.deadline&&<span className="tag tag-active">פעיל</span>}
                        {t.publisher&&<span className="tag tag-org">{t.publisher.length>18?t.publisher.slice(0,18)+'…':t.publisher}</span>}
                      </div>
                    </div>
                    <div className="tender-meta">
                      {t.publishDate&&<span>📅 פורסם: <strong>{formatDate(t.publishDate)}</strong></span>}
                      {t.deadline&&<span className={soon?'deadline-soon':'deadline-ok'}>⏰ הגשה עד: <strong>{formatDate(t.deadline)}</strong>{days!==null&&days>=0&&' ('+days+' ימים)'}</span>}
                      {t.status&&<span>📌 {t.status}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>

        <aside className="sidebar">
          <div className="sidebar-card">
            <div className="sidebar-title">👤 פרופיל עסקי</div>
            {hasProfile ? (
              <div>
                {profile.businessName&&<div style={{fontWeight:700,marginBottom:8,fontSize:'0.95rem'}}>{profile.businessName}</div>}
                {!!profile.categories?.length&&<div style={{fontSize:'0.8rem',color:'var(--muted)',marginBottom:4}}>תחומים: {profile.categories.length} נבחרו</div>}
                {!!profile.regions?.length&&<div style={{fontSize:'0.8rem',color:'var(--muted)',marginBottom:12}}>אזורים: {profile.regions.length} נבחרו</div>}
                <div style={{background:'var(--brand-pale)',borderRadius:8,padding:'10px 12px',textAlign:'center',marginBottom:12}}>
                  <div style={{fontSize:'1.6rem',fontWeight:800,color:'var(--brand)'}}>{matchedTenders.length}</div>
                  <div style={{fontSize:'0.75rem',color:'var(--muted)'}}>מכרזים מותאמים</div>
                </div>
                <Link href="/profile"><button className="apply-btn">✏️ עריכת פרופיל</button></Link>
              </div>
            ) : (
              <div style={{textAlign:'center',padding:'8px 0'}}>
                <div style={{fontSize:'2.5rem',marginBottom:8}}>👤</div>
                <div style={{fontSize:'0.85rem',color:'var(--muted)',marginBottom:14}}>הגדר פרופיל עסקי לקבל התאמות אישיות</div>
                <Link href="/profile"><button className="apply-btn">הגדר פרופיל ←</button></Link>
              </div>
            )}
          </div>
          <div className="sidebar-card">
            <div className="sidebar-title">⚙ סינון מהיר</div>
            <div className="filter-group"><label>גוף מפרסם</label>
              <select className="filter-select">
                <option>כל הגופים</option><option>ממשלה</option>
                <option>רשויות מקומיות</option><option>בתי חולים</option>
              </select>
            </div>
            <div className="filter-group"><label>נסגר בתוך</label>
              <input type="range" className="range-slider" min="1" max="180" defaultValue="90" />
              <div className="range-label">עד 90 ימים</div>
            </div>
          </div>
        </aside>
      </div>
      <footer className="footer">נתונים: <a href="https://next.obudget.org" target="_blank" rel="noopener noreferrer" style={{color:'var(--brand)'}}>BudgetKey / מינהל הרכש הממשלתי</a>{' · '}עדכון יומי ב-06:00</footer>
    </>
  )
}
