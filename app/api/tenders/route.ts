import { NextResponse } from 'next/server'

const API = 'https://next.obudget.org/api/query'

const STATUSES = `('פורסם','עתידי','פורסם ולא התקבלו השגות','פורסם והתקבלו השגות','בעדכון')`

function buildSQL(search: string, offset: number, limit = 1100): string {
  const today = new Date().toISOString().split('T')[0]
  const dateFilter = `(claim_date > '${today}' OR (claim_date IS NULL AND publication_date > '2026-01-01'))`
  const searchFilter = search
    ? `AND (description ILIKE '%${search.replace(/'/g, "''")}%' OR publisher ILIKE '%${search.replace(/'/g, "''")}%')`
    : ''
  return `SELECT
    tender_id, description, publisher, publisher_unit,
    claim_date, publication_date, status, page_url,
    tender_type_he, last_update_date
  FROM procurement_tenders_processed
  WHERE status IN ${STATUSES}
  AND ${dateFilter}
  ${searchFilter}
  ORDER BY publication_date DESC NULLS LAST, claim_date DESC NULLS LAST
  LIMIT ${limit} OFFSET ${offset}`
}

interface TenderRow {
  tender_id?: string | number
  description?: string
  publisher?: string
  publisher_unit?: string
  claim_date?: string
  publication_date?: string
  status?: string
  page_url?: string
  tender_type_he?: string
  last_update_date?: string
}

function parseTender(row: TenderRow) {
  return {
    id: String(row.tender_id || Math.random()),
    title: row.description || '',
    publisher: row.publisher || row.publisher_unit || '',
    publishDate: row.publication_date ? row.publication_date.split('T')[0] : '',
    deadline: row.claim_date ? row.claim_date.split('T')[0] : '',
    status: row.status || '',
    url: row.page_url || '',
    type: row.tender_type_he || '',
  }
}

async function fetchBatch(search: string, offset: number): Promise<TenderRow[]> {
  try {
    const sql = buildSQL(search, offset, 1100)
    const url = `${API}?query=${encodeURIComponent(sql)}`
    const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.rows as TenderRow[]) ?? []
  } catch {
    return []
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('q') || ''

    // 3 parallel batches of 1100 → covers all 3010+ tenders
    const [b0, b1, b2] = await Promise.all([
      fetchBatch(search, 0),
      fetchBatch(search, 1100),
      fetchBatch(search, 2200),
    ])

    const seen = new Set<string>()
    const tenders = [...b0, ...b1, ...b2]
      .map(parseTender)
      .filter(t => {
        if (!t.title || t.title === 'מכרז ללא כותרת') return false
        if (seen.has(t.id)) return false
        seen.add(t.id)
        return true
      })

    return NextResponse.json({ tenders, total: tenders.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
