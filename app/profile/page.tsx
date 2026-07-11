'use client'

import { useState, useEffect } from 'react'
import InternalShell from '../components/InternalShell'

const DARK = '#1a2330'
const BLUE = '#2b6fc4'
const MUTED = '#7a8794'

const BIZ = [
  { value: 'consulting', label: 'ייעוץ וניהול' },
  { value: 'tech', label: 'טכנולוגיה ותוכנה' },
  { value: 'marketing', label: 'שיווק ופרסום' },
  { value: 'construction', label: 'בינוי ותשתיות' },
  { value: 'legal', label: 'משפט וחשבונאות' },
  { value: 'education', label: 'חינוך והדרכה' },
  { value: 'security', label: 'אבטחה ושמירה' },
  { value: 'cleaning', label: 'ניקיון ותחזוקה' },
  { value: 'catering', label: 'קייטרינג ומזון' },
  { value: 'transport', label: 'הסעות ולוגיסטיקה' },
  { value: 'health', label: 'בריאות ורפואה' },
  { value: 'environment', label: 'איכות סביבה' },
]

const REGS = [
  { value: 'all', label: 'כל הארץ' },
  { value: 'national', label: 'ארצי / ממשלתי' },
  { value: 'north', label: 'צפון' },
  { value: 'haifa', label: 'חיפה' },
  { value: 'center', label: 'מרכז' },
  { value: 'tlv', label: 'תל אביב' },
  { value: 'south', label: 'דרום' },
  { value: 'jerusalem', label: 'ירושלים' },
]

const PUBS = [
  { value: 'all', label: 'כל המפרסמים' },
  { value: 'gov', label: 'משרדי ממשלה' },
  { value: 'local', label: 'רשויות מקומיות' },
  { value: 'health', label: 'מערכת הבריאות' },
  { value: 'edu', label: 'מוסדות חינוך' },
  { value: 'infra', label: 'חברות ממשלתיות' },
]

const selStyle = {
  width: '100%',
  padding: '11px 14px',
  paddingLeft: 34,
  borderRadius: 8,
  border: '1px solid #e2e7ec',
  background: '#f4f6f8',
  color: DARK,
  fontSize: 13.5,
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
  fontFamily: 'inherit',
}

export default function ProfilePage() {
  const [biz, setBiz] = useState<string[]>([])
  const [reg, setReg] = useState('all')
  const [pub, setPub] = useState('all')
  const [saved, setSaved] = useState(false)
  const [initial, setInitial] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('businessProfile')
      if (raw) {
        const p = JSON.parse(raw)
        const b = Array.isArray(p.businessType) ? p.businessType : (p.businessType ? [p.businessType] : [])
        setBiz(b)
        setReg(p.region || 'all')
        setPub(p.publisherType || 'all')
        setInitial(JSON.stringify({ b, r: p.region || 'all', p: p.publisherType || 'all' }))
      } else {
        setInitial(JSON.stringify({ b: [], r: 'all', p: 'all' }))
      }
    } catch {}
  }, [])

  const toggleBiz = (v: string) => {
    setBiz(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
    setSaved(false)
  }

  const current = JSON.stringify({ b: biz, r: reg, p: pub })
  const dirty = current !== initial

  const save = () => {
    localStorage.setItem('businessProfile', JSON.stringify({ businessType: biz, region: reg, publisherType: pub }))
    setInitial(current)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  let statusBg = '#f5efdc'
  let statusFg = '#8a6d1f'
  let statusBorder = '#e8ddbf'
  let statusText = 'לא נבחר סוג עסק — יוצגו כל המכרזים'
  if (biz.length === 1) {
    statusText = 'נבחרה קטגוריה אחת — מכרזים יסוננו לפי ' + (BIZ.find(b => b.value === biz[0])?.label || '')
  } else if (biz.length >= 2) {
    statusBg = '#e8f1fb'
    statusFg = '#1e5aa8'
    statusBorder = '#cfe0f4'
    statusText = 'נבחרו ' + biz.length + ' קטגוריות'
  }

  return (
    <InternalShell
      title="הגדרת פרופיל עסקי"
      subtitle="הפרופיל קובע אילו מכרזים יותאמו ויוצגו לכם"
      action={
        <button
          onClick={save}
          disabled={!dirty && !saved}
          style={{
            padding: '9px 18px',
            borderRadius: 8,
            border: 'none',
            background: BLUE,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: dirty ? 'pointer' : 'default',
            opacity: dirty || saved ? 1 : 0.6,
          }}
        >
          {saved ? 'נשמר ✓' : 'שמירת פרופיל'}
        </button>
      }
    >
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 26px 32px', background: '#f6f8fa' }}>
        <div style={{ background: '#fff', border: '1px solid #e6eaee', borderRadius: 12, padding: 22, marginBottom: 16 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: DARK, marginBottom: 4 }}>סוג העסק שלי</div>
          <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 16 }}>בחרו קטגוריה אחת או יותר — היא תקבע אילו מכרזים יוצגו לכם</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
            {BIZ.map(b => {
              const active = biz.includes(b.value)
              return (
                <button
                  key={b.value}
                  onClick={() => toggleBiz(b.value)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 8,
                    border: active ? '1.5px solid ' + BLUE : '1px solid #e2e7ec',
                    background: active ? '#e8f1fb' : '#fff',
                    color: active ? '#1e5aa8' : '#5b6b7a',
                    fontWeight: active ? 700 : 600,
                    fontSize: 13.5,
                    cursor: 'pointer',
                  }}
                >
                  {active ? '✓ ' : ''}{b.label}
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: statusBg, color: statusFg, border: '1px solid ' + statusBorder, fontSize: 12.5, fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusFg, display: 'inline-block' }}></span>
            {statusText}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #e6eaee', borderRadius: 12, padding: 22 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: DARK, marginBottom: 4 }}>אזור גאוגרפי</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 14 }}>פילטר משני — מצמצם לפי מיקום הפעילות</div>
            <div style={{ position: 'relative' }}>
              <select value={reg} onChange={e => { setReg(e.target.value); setSaved(false) }} style={selStyle}>
                {REGS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9aa6b2', pointerEvents: 'none' }}>▾</span>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e6eaee', borderRadius: 12, padding: 22 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: DARK, marginBottom: 4 }}>סוג מפרסם</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 14 }}>פילטר משני — משרדי ממשלה, רשויות, חברות</div>
            <div style={{ position: 'relative' }}>
              <select value={pub} onChange={e => { setPub(e.target.value); setSaved(false) }} style={selStyle}>
                {PUBS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9aa6b2', pointerEvents: 'none' }}>▾</span>
            </div>
          </div>
        </div>

        <div style={{ background: '#f0f6fd', border: '1px solid #cfe0f4', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>✦</div>
          <div style={{ fontSize: 13, color: DARK, lineHeight: 1.5 }}>
            הסוכן החכם משתמש בפרופיל העסקי הזה כדי להתאים אישית את המכרזים המוצגים לכם, לדרג אותם לפי רלוונטיות ולשלוח התראות על הזדמנויות חדשות שמתאימות בדיוק לתחום הפעילות שלכם.
          </div>
        </div>
      </div>
    </InternalShell>
  )
}
