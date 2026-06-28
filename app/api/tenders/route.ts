import { NextResponse } from 'next/server'

const API = 'https://next.obudget.org/api/query'
const STATUSES = `('פורסם','עתידי','פורסם ולא התקבלו השגות','פורסם והתקבלו השגות','בעדכון')`

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('q') || ''
    const offset = parseInt(searchParams.get('offset') || '0')
    const today = new Date().toISOString().split('T')[0]
    const dateFilter = `(claim_date > '${today}' OR (claim_date IS NULL AND publication_date > '2026-01-01'))`
    const searchFilter = search
      ? `AND (description ILIKE '%${search.replace(/'/g,"''")}%' OR publisher ILIKE '%${search.replace(/'/g,"''")}%')`
      : ''

    const sql = `SELECT
      publication_id, soproc_id, tender_id,
      description, publisher, publisher_unit,
      claim_date, publication_date, status, page_url, tender_type_he
    FROM procurement_tenders_processed
    WHERE status IN ${STATUSES} AND ${dateFilter} ${searchFilter}
    ORDER BY publication_date DESC NULLS LAST, claim_date DESC NULLS LAST
    LIMIT 1000 OFFSET ${offset}`

    const res = await fetch(`${API}?query=${encodeURIComponent(sql)}`, {
      headers: { Accept: 'application/json' }, cache: 'no-store'
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data = await res.json()
    const rows = (data?.rows ?? []) as Record<string, unknown>[]

    const tenders = rows
      .filter(r => r.description && r.description !== 'מכרז ללא כותרת')
      .map((r, i) => ({
        // Unique key: prefer publication_id, fallback to soproc_id, then offset+index
        id: String(r.publication_id || r.soproc_id || `${offset}_${i}`),
        title: String(r.description || ''),
        publisher: String(r.publisher || r.publisher_unit || ''),
        publishDate: r.publication_date ? String(r.publication_date).split('T')[0] : '',
        deadline: r.claim_date ? String(r.claim_date).split('T')[0] : '',
        status: String(r.status || ''),
        url: String(r.page_url || ''),
        type: String(r.tender_type_he || ''),
      }))

    return NextResponse.json({ tenders, count: tenders.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
