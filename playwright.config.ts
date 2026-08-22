import { defineConfig } from '@playwright/test';

// בדיקות עשן מול סביבה חיה (preview/production). BASE_URL נקבע ב-CI.
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.BASE_URL || 'https://tenders-agent-git-fix-qa-blockers-alonk.vercel.app',
    locale: 'he-IL',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined,
    viewport: { width: 1280, height: 800 },
  },
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
});
