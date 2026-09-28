#!/usr/bin/env tsx
/**
 * Captures the P3 acceptance screenshots (implementation.md §10 P3:
 * "screenshots saved to docs/screens/p3/"). Assumes `pnpm --filter @tula/web
 * dev` is already running on :3000 and the P2 seed has run.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(scriptDir, '..', '..', '..', 'docs', 'screens', 'p3');
mkdirSync(outDir, { recursive: true });

const BASE = 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(outDir, 'login.png'), fullPage: true });
  console.log('Saved login.png');

  await page.goto(`${BASE}/dev/ui`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(outDir, 'dev-ui.png'), fullPage: true });
  console.log('Saved dev-ui.png');

  // Sign in as a non-privileged seeded role (no TOTP detour) to reach the
  // shell + dashboard empty state.
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill('testing.officer@tula.test');
  await page.getByLabel('Password').fill(process.env.SEED_PASSWORD ?? 'tula-dev-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(`${BASE}/dashboard`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(outDir, 'dashboard-empty.png'), fullPage: true });
  console.log('Saved dashboard-empty.png');

  // Sidebar collapsed state.
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(outDir, 'dashboard-sidebar-collapsed.png'), fullPage: true });
  console.log('Saved dashboard-sidebar-collapsed.png');

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
