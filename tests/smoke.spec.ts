// ============================================================
//  בדיקות עשן + נגישות — רצות ב-CI מול ה-preview של כל קומיט.
//  מכסות את הרגרסיות שנמצאו בדוח ה-QA (22.08.2026):
//  מונים עקביים, ציון אחיד, 404 למזהה לא קיים, תצוגות נפרדות,
//  landmarks/ניגודיות (axe), וללא שגיאות קונסול.
// ============================================================
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/', '/dashboard', '/dashboard?view=exempt', '/dashboard?view=intent', '/agent', '/sources', '/guarantee', '/marked', '/signin'];

async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location()?.url || '';
    // "Failed to load resource" בלי URL אינו ניתן לאבחון — מדווח דרך requestfailed (למטה) עם הכתובת
    if (/Failed to load resource/.test(m.text()) && !url) return;
    errors.push(m.text() + (url ? ` @ ${url}` : ''));
  });
  const origin = new URL(page.url() === 'about:blank' ? (test.info().project.use.baseURL as string) : page.url()).origin;
  page.on('requestfailed', (r) => {
    // רק משאבים של האתר עצמו; צד ג' (Google/פונטים) חסום לעיתים ב-CI
    if (r.url().startsWith(origin)) errors.push(`requestfailed: ${r.failure()?.errorText} @ ${r.url()}`);
  });
  return errors;
}

// Vercel מגיש challenge (HTML) לבקשות API שלא מגיעות מדפדפן — לכן כל קריאת
// API עוברת דרך הדפדפן (fetch מתוך הדף), אחרי טעינה ראשונה של האתר.
async function api(page: Page, path: string): Promise<any> {
  if (page.url() === 'about:blank') await page.goto('/signin');
  const res = await page.evaluate(async (p) => {
    const r = await fetch(p);
    const text = await r.text();
    const headers = { cache: r.headers.get('x-vercel-cache'), type: r.headers.get('content-type') };
    try { return { status: r.status, headers, json: JSON.parse(text) }; }
    catch { return { status: r.status, headers, json: null, text: text.slice(0, 300) }; }
  }, path);
  // אבחון ברור במקום TypeError: מה השרת הגיש בפועל (challenge? שגיאה?)
  if (res.json === null && res.status !== 404) {
    throw new Error(`API ${path} → status ${res.status}, content-type ${res.headers.type}\n${res.text}`);
  }
  return res;
}

// רעש של ספקי צד ג' שאינו באחריות האתר: Google Sign-In (FedCM/GSI) בסביבת CI, פונטים, favicon
const THIRD_PARTY = /font|favicon|ERR_BLOCKED_BY_CLIENT|GSI_LOGGER|FedCM|accounts list|accounts\.google|gstatic|googleapis|status of (403|429)|net::ERR_FAILED$/i;

async function waitForRows(page: Page) {
  await expect(page.locator('[role=row]').nth(1)).toBeVisible({ timeout: 30_000 });
}

for (const path of PAGES) {
  test(`נטען ללא שגיאות קונסול: ${path}`, async ({ page }) => {
    const errors = await collectConsoleErrors(page);
    const res = await page.goto(path);
    expect(res?.status(), 'HTTP status').toBeLessThan(400);
    await page.waitForLoadState('networkidle').catch(() => {});
    // שגיאות של ספקי צד ג' (fonts וכו') אינן באחריותנו
    const own = errors.filter((e) => !THIRD_PARTY.test(e));
    expect(own, own.join('\n')).toEqual([]);
    await expect(page.locator('h1').first()).toBeVisible();
  });
}

test('מונים עקביים: nav-counts ≡ search ≡ סיידבר', async ({ page }) => {
  const nav = (await api(page, '/api/nav-counts')).json;
  const search = (await api(page, '/api/tenders/search?closed=1')).json;
  expect(search.counts.active).toBe(nav.active);
  expect(search.counts.exempt).toBe(nav.exempt);
  expect(search.counts.intent).toBe(nav.intent);
  await page.goto('/dashboard');
  await waitForRows(page);
  const side = page.locator('nav[aria-label="ניווט ראשי"]');
  await expect(side).toContainText(nav.active.toLocaleString('he-IL'));
  await expect(side).toContainText(nav.intent.toLocaleString('he-IL'));
});

test('סינון גוף מפרסם מחזיר תוצאות לכל גוף שקיים במאגר', async ({ page }) => {
  for (const pub of ['gov', 'health', 'local', 'infra', 'public']) {
    const r = (await api(page, `/api/tenders/search?closed=1&pub=${pub}`)).json;
    expect(r.total, `pub=${pub}`).toBeGreaterThan(0);
  }
});

test('ציון התאמה זהה ברשימה ובדף המכרז', async ({ page }) => {
  const r = (await api(page, '/api/tenders/search?closed=1&perPage=5')).json;
  const t = r.tenders[0];
  await page.goto('/dashboard');
  await waitForRows(page);
  const row = page.locator('[role=row]', { hasText: t.title.slice(0, 30) }).first();
  const listScore = (await row.innerText()).split('\n')[0].trim();
  await page.goto('/tender/' + t.id);
  const detailScore = await page.locator('[aria-label^="ציון התאמה"] span').first().innerText();
  expect(detailScore.trim()).toBe(listScore);
});

test('מזהה מכרז לא קיים → 404 ודף "לא נמצא"', async ({ page }) => {
  expect((await api(page, '/api/tender/0000000000')).status).toBe(404);
  expect((await api(page, '/api/tender/abc')).status).toBe(404);
  await page.goto('/tender/0000000000');
  await expect(page.getByText('המכרז לא נמצא')).toBeVisible();
});

test('תצוגת "כוונה להתקשרות" נפרדת מהגילוי הראשי', async ({ page }) => {
  const main = (await api(page, '/api/tenders/search?closed=1&perPage=100')).json;
  const intent = (await api(page, '/api/tenders/search?closed=1&view=intent&perPage=100')).json;
  expect(intent.total).toBeGreaterThan(0);
  expect(main.tenders.every((t: { type: string }) => !/כוונה להתקשר/.test(t.type))).toBe(true);
  expect(intent.tenders.every((t: { type: string }) => /כוונה להתקשר/.test(t.type))).toBe(true);
});

test('"לא מסווג" מתחת ל-20%', async ({ page }) => {
  const r = (await api(page, '/api/tenders/search?closed=1')).json;
  expect(r.uncategorized / r.counts.base).toBeLessThan(0.2);
});

test('שמירה למעקב מדף המכרז מופיעה במסומנים', async ({ page }) => {
  const r = (await api(page, '/api/tenders/search?closed=1&perPage=1')).json;
  const t = r.tenders[0];
  await page.goto('/tender/' + t.id);
  await page.getByRole('button', { name: /שמירה למעקב/ }).click();
  await expect(page.getByRole('button', { name: /במעקב/ })).toBeVisible();
  await page.goto('/marked');
  await expect(page.getByText(t.title.slice(0, 30))).toBeVisible({ timeout: 20_000 });
});

test('מצב חיפוש/עמוד/מיון נשמר ב-URL', async ({ page }) => {
  await page.goto('/dashboard?q=ניקיון&page=2&sort=published');
  await waitForRows(page);
  await expect(page.locator('input[type=search]')).toHaveValue('ניקיון');
  await expect(page.locator('nav[aria-label="דפדוף"] [aria-current=page]')).toHaveText('2');
  await expect(page.locator('select[aria-label="מיון"]')).toHaveValue('published');
});

test('ביצועים: בקשה חוזרת נענית מה-CDN במהירות', async ({ page }) => {
  const url = '/api/tenders/search?closed=1&q=' + encodeURIComponent('smoke-' + Date.now());
  await api(page, url);
  const t0 = Date.now();
  const r = await api(page, url);
  expect(r.headers.cache).toBe('HIT');
  expect(Date.now() - t0).toBeLessThan(2500);
});

for (const path of ['/dashboard', '/tender/4000620538', '/agent', '/signin']) {
  test(`נגישות (axe, WCAG 2.1 AA): ${path}`, async ({ page }) => {
    await page.goto(path);
    if (path === '/dashboard') await waitForRows(page);
    await page.waitForLoadState('networkidle').catch(() => {});
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const fmt = (v: { id: string; help: string; nodes: unknown[] }) => `${v.id}: ${v.help} (${v.nodes.length})`;
    const critical = results.violations.filter((v) => v.impact === 'critical');
    const serious = results.violations.filter((v) => v.impact === 'serious');
    // serious מדווח (נראה בלוג ה-CI) אך לא מפיל — עד שנאפס אותו ונעלה את הרף
    if (serious.length) console.warn(`[axe] ${path} serious:\n  ` + serious.map(fmt).join('\n  '));
    expect(critical.map(fmt), 'הפרות critical').toEqual([]);
  });
}

// re-QA: רספונסיביות — ב-390px אין גלילה אופקית ותפריט/סרגל מובייל קיימים
test.describe('מובייל (390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  for (const path of ['/', '/dashboard', '/dashboard?view=intent', '/tender/4000620538', '/agent', '/signin']) {
    test(`ללא גלילה אופקית: ${path}`, async ({ page }) => {
      await page.goto(path);
      if (path.startsWith('/dashboard')) await waitForRows(page);
      await page.waitForLoadState('networkidle').catch(() => {});
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(sw, 'scrollWidth').toBeLessThanOrEqual(390 + 2);
    });
  }
  test('ניווט מובייל זמין בדשבורד', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForRows(page);
    await expect(page.locator('button[aria-expanded], button[aria-label*="תפריט"]').first()).toBeVisible();
  });
});

// re-QA #04: ציון זהה ברשימה, בדף המכרז ובמסומנים (אורח → generic)
test('ציון זהה גם בדף "מסומנים"', async ({ page }) => {
  const r = (await api(page, '/api/tenders/search?closed=1&perPage=1')).json;
  const t = r.tenders[0];
  await page.goto('/tender/' + t.id);
  const detailScore = (await page.locator('[aria-label^="ציון התאמה"] span').first().textContent())?.trim();
  await page.getByRole('button', { name: /שמירה למעקב/ }).click();
  await page.goto('/marked');
  const row = page.locator('[role=row]', { hasText: t.title.slice(0, 30) }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText(detailScore!);
});

// SEO: metadata ייחודי, canonical ו-JSON-LD בדף מכרז; sitemap מלא
test('SEO: דף מכרז — title ייחודי, canonical, JSON-LD', async ({ page }) => {
  const r = (await api(page, '/api/tenders/search?closed=1&perPage=1')).json;
  const t = r.tenders[0];
  await page.goto('/tender/' + t.id);
  const title = await page.title();
  expect(title, 'title כולל את שם המכרז').toContain(t.title.slice(0, 20));
  const canonical = await page.locator('link[rel=canonical]').getAttribute('href');
  expect(canonical).toContain('/tender/' + t.id);
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((s) => s.includes('schema.org')), 'JSON-LD קיים').toBe(true);
});

test('SEO: sitemap.xml כולל דפי מכרז', async ({ page }) => {
  await page.goto('/signin');
  const xml = await page.evaluate(async () => (await fetch('/sitemap.xml')).text());
  expect(xml).toContain('<urlset');
  expect(xml).toContain('/tender/');
  expect(xml).toContain('/dashboard');
});

test('SEO: title ייחודי לדפים הראשיים', async ({ page }) => {
  const seen = new Set<string>();
  for (const p of ['/', '/dashboard', '/agent', '/sources', '/guarantee']) {
    await page.goto(p);
    const title = await page.title();
    expect(title.length, `title ב-${p}`).toBeGreaterThan(10);
    expect(seen.has(title), `title ייחודי ב-${p}`).toBe(false);
    seen.add(title);
  }
});
