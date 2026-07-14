import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { syncTendersFromSources } from "@/app/lib/db";
import { scoreTender } from "@/app/lib/scoring";

const API = 'https://next.obudget.org/api/query'
const STATUSES = `('פורסם','עתידי','פורסם ולא התקבלו השגות','פורסם והתקבלו השגות','בעדכון')`
const TO_EMAIL = 'alonkatabi17@gmail.com'

interface TenderRow {
  tender_id?: unknown; description?: string; publisher?: string; publisher_unit?: string;
  claim_date?: string; publication_date?: string; status?: string; page_url?: string;
}
interface Tender {
  id: string; title: string; publisher: string; publishDate: string;
  deadline: string; status: string; url: string; score: number; matched: boolean;
}
interface Profile {
  businessName?: string; categories?: string[]; regions?: string[];
  publishers?: string[]; keywords?: string;
}

// דירוג — המנוע המאוחד (scoring.ts): רלוונטיות + דחיפות + טריות + הקשר,
// ציון תצוגה 50-95 — זהה לדשבורד ולסוכן החכם.
function scoreMatch(
  title: string, publisher: string, profile: Profile,
  publishDate = '', deadline = ''
): { display: number; matched: boolean } {
  const bd = scoreTender(
    { title, publisher, publishDate, deadline },
    { categories: profile.categories, region: profile.regions, publisher_type: profile.publishers, keywords: profile.keywords }
  )
  return { display: bd.display, matched: bd.matched }
}

function formatDate(d: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit', year:'numeric' }) } catch { return d }
}

function daysLeft(deadline: string): number | null {
  if (!deadline) return null
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
}

async function fetchBatch(offset: number): Promise<TenderRow[]> {
  const today = new Date().toISOString().split('T')[0]
  const dateFilter = `(claim_date > '${today}' OR (claim_date IS NULL AND publication_date > '2026-01-01'))`
  const sql = `SELECT tender_id, description, publisher, publisher_unit, claim_date, publication_date, status, page_url
    FROM procurement_tenders_all
    WHERE status IN ${STATUSES} AND ${dateFilter}
    ORDER BY publication_date DESC NULLS LAST LIMIT 1000 OFFSET ${offset}`
  try {
    const res = await fetch(`${API}?query=${encodeURIComponent(sql)}`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.rows ?? []) as TenderRow[]
  } catch { return [] }
}

function buildEmailHTML(tenders: Tender[], profile: Profile, dateStr: string): string {
  const topTenders = tenders.slice(0, 20)
  const closingSoon = tenders.filter(t => { const d = daysLeft(t.deadline); return d !== null && d >= 0 && d <= 7 })

  const tenderRows = topTenders.map(t => {
    const days = daysLeft(t.deadline)
    const soon = days !== null && days >= 0 && days <= 7
    const scoreLabel = t.score >= 80 ? `🟢 התאמה גבוהה · ${t.score}` : t.score >= 65 ? `🟡 התאמה טובה · ${t.score}` : `🔵 התאמה · ${t.score}`
    return `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:12px 8px;font-size:14px;direction:rtl;">
          ${t.url
            ? `<a href="${t.url}" style="color:#19A5DC;text-decoration:none;font-weight:600;">${t.title}</a>`
            : `<span style="font-weight:600;">${t.title}</span>`}
          <div style="font-size:12px;color:#76838F;margin-top:4px;">
            🏛️ ${t.publisher || '—'}
            &nbsp;·&nbsp; 📅 ${formatDate(t.publishDate)}
            ${t.deadline ? `&nbsp;·&nbsp; ⏰ ${formatDate(t.deadline)}${days !== null && days >= 0 ? ` (${days} ימים)` : ''}` : ''}
          </div>
        </td>
        <td style="padding:12px 8px;white-space:nowrap;font-size:12px;${soon?'color:#DC2626;font-weight:700;':'color:#0D9488;'}">${soon ? '🚨 נסגר בקרוב' : scoreLabel}</td>
      </tr>`
  }).join('')

  const closingSection = closingSoon.length > 0 ? `
    <div style="background:#FEE2E2;border:1px solid #DC2626;border-radius:8px;padding:16px;margin-bottom:24px;direction:rtl;">
      <div style="font-weight:700;color:#DC2626;margin-bottom:8px;">🚨 ${closingSoon.length} מכרזים נסגרים השבוע — פעל עכשיו!</div>
      ${closingSoon.slice(0,5).map(t => `
        <div style="padding:6px 0;border-bottom:1px solid #FECACA;font-size:13px;">
          ${t.url ? `<a href="${t.url}" style="color:#DC2626;font-weight:600;">${t.title}</a>` : t.title}
          — עד ${formatDate(t.deadline)}
        </div>`).join('')}
    </div>` : ''

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6F8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F8;padding:24px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr><td style="background:#19A5DC;padding:24px 32px;direction:rtl;">
          <div style="font-size:22px;font-weight:800;color:#fff;">שווה מכרזים 📋</div>
          <div style="color:rgba(255,255,255,.85);font-size:14px;margin-top:4px;">דוח מכרזים יומי · ${dateStr}</div>
          ${profile.businessName ? `<div style="color:rgba(255,255,255,.7);font-size:13px;margin-top:2px;">👤 ${profile.businessName}</div>` : ''}
        </td></tr>

        <!-- Stats -->
        <tr><td style="padding:20px 32px;background:#F4F6F8;direction:rtl;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background:#fff;border-radius:8px;padding:12px;width:30%;">
                <div style="font-size:28px;font-weight:800;color:#1A1A1A;">${tenders.length}</div>
                <div style="font-size:12px;color:#76838F;">מכרזים מותאמים</div>
              </td>
              <td width="16"></td>
              <td align="center" style="background:#fff;border-radius:8px;padding:12px;width:30%;">
                <div style="font-size:28px;font-weight:800;color:#DC2626;">${closingSoon.length}</div>
                <div style="font-size:12px;color:#76838F;">נסגרים השבוע</div>
              </td>
              <td width="16"></td>
              <td align="center" style="background:#fff;border-radius:8px;padding:12px;width:30%;">
                <div style="font-size:28px;font-weight:800;color:#0D9488;">${tenders.filter(t=>{const d=daysLeft(t.deadline);return d!==null&&d>=0&&d<=30}).length}</div>
                <div style="font-size:12px;color:#76838F;">נסגרים ב-30 יום</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:24px 32px;direction:rtl;">
          ${closingSection}

          <div style="font-size:16px;font-weight:700;margin-bottom:12px;color:#1A1A1A;">
            ⭐ ${Math.min(tenders.length, 20)} מכרזים מובילים לפרופיל שלך
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr style="background:#F4F6F8;">
              <th style="padding:8px;font-size:12px;color:#76838F;text-align:right;">מכרז</th>
              <th style="padding:8px;font-size:12px;color:#76838F;text-align:right;">סטטוס</th>
            </tr>
            ${tenderRows}
          </table>

          ${tenders.length > 20 ? `<div style="text-align:center;margin-top:16px;font-size:13px;color:#76838F;">ועוד ${tenders.length - 20} מכרזים נוספים...</div>` : ''}
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:0 32px 24px;text-align:center;">
          <a href="https://tenders-agent.vercel.app/dashboard"
            style="display:inline-block;background:#19A5DC;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
            פתח את הדשבורד המלא ←
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#F4F6F8;padding:16px 32px;text-align:center;font-size:12px;color:#76838F;direction:rtl;">
          שווה מכרזים · עדכון יומי ב-06:00 · נתונים מ-BudgetKey / מינהל הרכש הממשלתי
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  // Auth check
  const secret =
    req.headers.get('authorization')?.replace('Bearer ', '')
    || req.headers.get('x-cron-secret')
    || new URL(req.url).searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
          // Sync the full tender list into the DB (best-effort; must not block
          // the email-matching flow below if it fails).
          let dbSync: { fetched: number; upserted: number } | { error: string };
          try {
                    dbSync = await syncTendersFromSources();
          } catch (syncErr) {
                    dbSync = { error: String(syncErr) };
          }
    
    // Default profile (used when no localStorage profile available server-side)
    // Can be overridden via query params in the future
    const profile: Profile = {
      businessName: process.env.PROFILE_NAME || 'לקוח שווה מכרזים',
      categories: (process.env.PROFILE_CATEGORIES || 'consulting,tech,marketing').split(','),
      regions: (process.env.PROFILE_REGIONS || 'national,tlv,center').split(','),
      publishers: (process.env.PROFILE_PUBLISHERS || 'gov,local').split(','),
      keywords: process.env.PROFILE_KEYWORDS || '',
    }

    // Fetch all tenders (4 batches in parallel)
    const batches = await Promise.all([
      fetchBatch(0), fetchBatch(1000), fetchBatch(2000), fetchBatch(3000)
    ])

    console.log('Cron: batch sizes =', batches.map(b => b.length), 'profile =', JSON.stringify(profile))

    const seen = new Set<string>()
    const tenders: Tender[] = batches
      .flat()
      .filter(r => r.description && r.description !== 'מכרז ללא כותרת')
      .map((r, i) => {
        const publishDate = r.publication_date ? r.publication_date.split('T')[0] : ''
        const deadline = r.claim_date ? r.claim_date.split('T')[0] : ''
        const { display, matched } = scoreMatch(r.description || '', r.publisher || r.publisher_unit || '', profile, publishDate, deadline)
        return {
          id: String(r.tender_id || i),
          title: r.description || '',
          publisher: r.publisher || r.publisher_unit || '',
          publishDate,
          deadline,
          status: r.status || '',
          url: r.page_url || '',
          score: display,
          matched,
        }
      })
      .filter(t => {
        if (!t.title || seen.has(t.id)) return false
        seen.add(t.id)
        return t.matched // לפחות פגיעה תוכנית אחת בפרופיל
      })
      .sort((a, b) => b.score - a.score)

    console.log('Cron: matched tenders =', tenders.length, 'dbSync =', JSON.stringify(dbSync))

    if (tenders.length === 0) {
      return NextResponse.json({ message: 'No matching tenders found, email not sent', dbSync })
    }

    // Send email via Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })

    const dateStr = new Date().toLocaleDateString('he-IL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    const html = buildEmailHTML(tenders, profile, dateStr)

    const mailInfo = await transporter.sendMail({
      from: `"שווה מכרזים 📋" <${process.env.GMAIL_USER}>`,
      to: TO_EMAIL,
      subject: `📋 ${tenders.length} מכרזים מותאמים לפרופיל שלך · ${new Date().toLocaleDateString('he-IL')}`,
      html,
    })

    console.log('Cron: email sent, messageId =', mailInfo.messageId, 'response =', mailInfo.response)

    // --- התראה חכמה: מכרזים חדשים (פורסמו ביומיים האחרונים) בהתאמה גבוהה (80+) ---
    const cutoff = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]
    const hotNew = tenders.filter(t => t.score >= 80 && t.publishDate && t.publishDate >= cutoff)
    let alertSent = 0
    if (hotNew.length > 0) {
      const alertHtml = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#F4F6F8;font-family:Arial,sans-serif;direction:rtl;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#1e9e5a;padding:20px 28px;color:#fff;">
      <div style="font-size:20px;font-weight:800;">🔔 ${hotNew.length} מכרזים חדשים בהתאמה גבוהה</div>
      <div style="font-size:13px;opacity:.85;margin-top:4px;">פורסמו ביומיים האחרונים · ציון 80+</div>
    </div>
    <div style="padding:20px 28px;">
      ${hotNew.slice(0, 10).map(t => `
        <div style="padding:12px 0;border-bottom:1px solid #eee;">
          ${t.url ? `<a href="${t.url}" style="color:#1e5aa8;font-weight:700;font-size:14px;text-decoration:none;">${t.title}</a>` : `<span style="font-weight:700;font-size:14px;">${t.title}</span>`}
          <div style="font-size:12px;color:#76838F;margin-top:4px;">
            🏛️ ${t.publisher || '—'} · 🟢 ציון ${t.score}
            ${t.deadline ? ` · ⏰ הגשה עד ${formatDate(t.deadline)}` : ''}
          </div>
        </div>`).join('')}
      <div style="text-align:center;margin-top:18px;">
        <a href="https://tenders-agent.vercel.app/dashboard" style="display:inline-block;background:#1e9e5a;color:#fff;padding:11px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">לכל המכרזים בדשבורד ←</a>
      </div>
    </div>
  </div>
</body></html>`
      await transporter.sendMail({
        from: `"שווה מכרזים 🔔" <${process.env.GMAIL_USER}>`,
        to: TO_EMAIL,
        subject: `🔔 ${hotNew.length} מכרזים חדשים בהתאמה גבוהה לפרופיל שלך`,
        html: alertHtml,
      })
      alertSent = hotNew.length
      console.log('Cron: hot-new alert sent,', hotNew.length, 'tenders')
    }

    return NextResponse.json({
      success: true,
      matched: tenders.length,
      hot_new_alert: alertSent,
      sent_to: TO_EMAIL,
      date: dateStr,
      dbSync,
    })
  } catch (err) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
