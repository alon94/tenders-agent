'use client'
import { useEffect, useState, useCallback } from 'react'

interface Tender {
  id: string
  title: string
  publisher: string
  publishDate: string
  deadline: string
  status: string
  url: string
  description?: string
}

function formatDate(d: string) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit', year:'numeric' })
  } catch { return d }
}

function daysLeft(deadline: string) {
  if (!deadline) return null
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  return diff
}

export default function Dashboard() {
  const [tenders, setTenders] = useState<Tender[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [lastUpdate, setLastUpdate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/tenders')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTenders(data.tenders || [])
      setLastUpdate(new Date().toLocaleTimeString('he-IL'))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינת מכרזים')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = tenders.filter(t => {
    const q = search.toLowerCase()
    const matchSearch = !q || t.title?.toLowerCase().includes(q) || t.publisher?.toLowerCase().includes(q)
    if (activeTab === 'closing') {
      const d = daysLeft(t.deadline)
      return matchSearch && d !== null && d >= 0 && d <= 7
    }
    if (activeTab === 'new') {
      if (!t.publishDate) return false
      const diff = Math.ceil((Date.now() - new Date(t.publishDate).getTime()) / 86400000)
      return matchSearch && diff <= 7
    }
    return matchSearch
  })

  const closing7 = tenders.filter(t => { const d = daysLeft(t.deadline); return d !== null && d >= 0 && d <= 7 }).length
  const newLast7 = tenders.filter(t => { if (!t.publishDate) return false; const diff = Math.ceil((Date.now() - new Date(t.publishDate).getTime()) / 86400000); return diff <= 7 }).length

  return (
    <>
      {/* TOPBAR */}
      <header className="topbar">
        <div className="topbar-icons">
          <div className="avatar">א</div>
          <button className="icon-btn" title="התראות">🔔</button>
        </div>
        <nav className="topbar-nav">
          <a href="#">מקורות</a>
          <a href="#">AgentOS</a>
          <a href="#">ערביות וליווי</a>
          <a href="#">התראות</a>
          <a href="#">הגשות שלי</a>
          <a href="/dashboard" className="active">גילוי מכרזים</a>
        </nav>
        <a href="/dashboard" className="topbar-logo">
          שווה מכרזים
          <span className="badge">מודול בתוך שווה ביזנס 360</span>
        </a>
      </header>

      {/* STATUS BAR */}
      <div className="status-bar">
        <span className="status-dot" />
        <span>
          סריקה מוטמעת: <strong>{tenders.length.toLocaleString()}</strong> מכרזים · מקור{' '}
          <a href="https://next.obudget.org" target="_blank" rel="noopener noreferrer">data.gov.il</a>
        </span>
        {lastUpdate && <span>· עודכן: {lastUpdate}</span>}
        <button className="refresh-btn" onClick={load} disabled={loading}>
          {loading ? 'טוען...' : 'רענון'}
        </button>
      </div>

      {/* MAIN LAYOUT */}
      <div className="page-wrap">
        <main>
          {/* STATS */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-num ink">{loading ? '…' : tenders.length.toLocaleString()}</div>
              <div className="stat-label">מכרזים פעילים במאגר</div>
            </div>
            <div className="stat-card">
              <div className="stat-num teal">{loading ? '…' : closing7.toLocaleString()}</div>
              <div className="stat-label">נסגרים בשבוע הקרוב</div>
            </div>
            <div className="stat-card">
              <div className="stat-num brand">{loading ? '…' : newLast7.toLocaleString()}</div>
              <div className="stat-label">התאמות לפרופיל שלך (+80%)</div>
            </div>
            <div className="stat-card">
              <div className="stat-num amber">0</div>
              <div className="stat-label">פורסמו ב-7 הימים האחרונים</div>
            </div>
          </div>

          {/* SEARCH + TABS */}
          <div className="search-area">
            <div className="search-row">
              <div className="search-input-wrap">
                <input
                  className="search-input"
                  placeholder="חיפוש חופשי: נושא, גוף מפרסם, מספר מכרז..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <span className="search-icon">🔍</span>
              </div>
              <button className="smart-btn" onClick={load}>+ צור התראה מהחיפוש</button>
            </div>
            <div className="filter-tabs">
              <button className={`filter-tab active`} style={activeTab==='all'?{background:'var(--brand)',color:'#fff'}:{}} onClick={() => setActiveTab('all')}>
                📋 מדריך מפרסמים חי
              </button>
              <button className="filter-tab" style={activeTab==='closing'?{background:'var(--red)',color:'#fff',borderColor:'var(--red)'}:{}} onClick={() => setActiveTab('closing')}>
                🚨 נסגרים השבוע
              </button>
              <button className="filter-tab" onClick={() => setActiveTab('tech')}>טכנולוגיה</button>
              <button className="filter-tab" onClick={() => setActiveTab('new')}>חדשים השבוע</button>
              <button className="filter-tab">★ התאמה +80%</button>
              <button className="filter-tab">בינוי ותשתיות</button>
              <button className="filter-tab">🏢 לעסקים קטנים</button>
              <button className="filter-tab">ייצוג</button>
            </div>
          </div>

          {/* TENDER LIST */}
          {loading && (
            <div className="loading-state">
              <div className="spinner" />
              <div>טוען מכרזים...</div>
            </div>
          )}
          {error && <div className="error-state">⚠️ {error}</div>}
          {!loading && !error && (
            <div className="tender-list">
              {filtered.length === 0 && (
                <div className="loading-state">לא נמצאו מכרזים תואמים</div>
              )}
              {filtered.map(t => {
                const days = daysLeft(t.deadline)
                const isClosingSoon = days !== null && days >= 0 && days <= 7
                return (
                  <div className="tender-card" key={t.id}>
                    <div className="tender-card-top">
                      <div className="tender-title">
                        {t.url ? (
                          <a href={t.url} target="_blank" rel="noopener noreferrer">{t.title}</a>
                        ) : t.title}
                      </div>
                      <div className="tender-tags">
                        {isClosingSoon && <span className="tag tag-closing">🚨 נסגר בקרוב</span>}
                        {!isClosingSoon && t.deadline && <span className="tag tag-active">פעיל</span>}
                        {t.publisher && <span className="tag tag-org">{t.publisher.length > 18 ? t.publisher.slice(0,18)+'…' : t.publisher}</span>}
                      </div>
                    </div>
                    <div className="tender-meta">
                      {t.publishDate && (
                        <span>📅 פורסם: <strong>{formatDate(t.publishDate)}</strong></span>
                      )}
                      {t.deadline && (
                        <span className={isClosingSoon ? 'deadline-soon' : 'deadline-ok'}>
                          ⏰ הגשה עד: <strong>{formatDate(t.deadline)}</strong>
                          {days !== null && days >= 0 && ` (${days} ימים)`}
                        </span>
                      )}
                      {t.status && t.status !== 'פעיל' && <span>📌 {t.status}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-card">
            <div className="sidebar-title">⚙ סינון | איפוס</div>
            <div className="filter-group">
              <label>תחום עיסוק</label>
              <select className="filter-select">
                <option>כל התחומים</option>
                <option>טכנולוגיה</option>
                <option>בינוי ותשתיות</option>
                <option>ביטחון ומשטרה</option>
                <option>בריאות</option>
                <option>חינוך</option>
                <option>תחבורה ותשתיות</option>
                <option>רשויות מקומיות</option>
              </select>
            </div>
            <div className="filter-group">
              <label>גוף מפרסם</label>
              <select className="filter-select">
                <option>כל הגופים</option>
                <option>מינהל הרכש הממשלתי</option>
                <option>רשויות מקומיות</option>
                <option>בתי חולים</option>
                <option>אוניברסיטאות</option>
              </select>
            </div>
            <div className="filter-group">
              <label>סוג פרסום</label>
              <select className="filter-select">
                <option>כל הסוגים</option>
                <option>מכרז פומבי</option>
                <option>מכרז מוגבל</option>
                <option>קנייה מרוכזת</option>
              </select>
            </div>
            <div className="filter-group">
              <label>נסגר בתוך</label>
              <input type="range" className="range-slider" min="1" max="180" defaultValue="90" />
              <div className="range-label">עד 90 ימים</div>
            </div>
            <div className="filter-group">
              <label className="checkbox-row">
                <input type="checkbox" />
                הצג גם מכרזים שנסגרו
              </label>
              <label className="checkbox-row">
                <input type="checkbox" />
                הצג גם תאריכים ללא מועד אחרון
              </label>
            </div>
            <button className="apply-btn">◄ הסוכן החכם</button>
          </div>
        </aside>
      </div>

      <footer className="footer">
        נתונים: <a href="https://next.obudget.org" target="_blank" rel="noopener noreferrer" style={{color:'var(--brand)'}}>BudgetKey / מינהל הרכש הממשלתי</a>
        {' · '}עדכון יומי ב-06:00
      </footer>
    </>
  )
}
