import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * WCAG 2.1 AA (implementation.md §7.9, §10 P3 acceptance): 0 serious/critical
 * violations on `/login` and `/dev/ui`.
 */
for (const path of ['/login', '/dev/ui']) {
  test(`${path} has no serious or critical accessibility violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const seriousOrCritical = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );

    expect(
      seriousOrCritical,
      seriousOrCritical.map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))`).join('\n'),
    ).toEqual([]);
  });
}

test('login is fully keyboard-operable with a visible focus ring', async ({ page }) => {
  await page.goto('/login');
  await page.keyboard.press('Tab'); // email
  await expect(page.getByLabel('Email')).toBeFocused();
  await page.keyboard.press('Tab'); // password
  await expect(page.getByLabel('Password')).toBeFocused();
  await page.keyboard.press('Tab'); // sign in button
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeFocused();
});
