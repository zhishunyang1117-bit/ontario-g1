// 手机宽度布局、深色模式配色、手机导航与专注模式。
const test = require('node:test');
const assert = require('node:assert/strict');
const { MOBILE, sharedBrowser, openApp, nav, answer, startPractice, noHorizontalScroll } = require('./helpers');

const browser = sharedBrowser();

// 0（黑）~1（白）的相对亮度
const luminance = (page, selector) => page.evaluate(sel => {
  const el = document.querySelector(sel);
  let color = getComputedStyle(el).backgroundColor;
  for (let node = el; node && /rgba\(0, 0, 0, 0\)|transparent/.test(color); node = node.parentElement) color = getComputedStyle(node).backgroundColor;
  const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}, selector);

test('手机宽度（390px）下所有页面都没有横向滚动', async () => {
  const { page } = await openApp(browser, { viewport: MOBILE, storage: { 'g1-wrong': { 'LA-01': 1, 'SA-04': 2 }, 'g1-bookmarks': { 'SC-45': true }, 'g1-hist': { 'LA-01': { c: 0, w: 1 }, 'SA-04': { c: 1, w: 2 } } } });
  await noHorizontalScroll(page, '学习总览');
  for (const name of ['practice', 'exam', 'wrong', 'bookmarks', 'stats', 'settings']) {
    await nav(page, name);
    await noHorizontalScroll(page, name);
  }
  await startPractice(page);
  await noHorizontalScroll(page, '答题页');
  for (let i = 0; i < 10; i++) {
    await answer(page, i % 2 === 0);
    await page.click(i < 9 ? '[data-action="next"]' : '.quiz-actions [data-action="finish"]');
  }
  await page.locator('.review-item summary').first().click();
  await noHorizontalScroll(page, '结果页');
});

test('手机导航：菜单可以打开，按 Esc 或点遮罩关闭', async () => {
  const { page } = await openApp(browser, { viewport: MOBILE });
  await page.click('#mobile-menu');
  assert.equal(await page.locator('#mobile-menu').getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.body.classList.contains('sidebar-open')), false);
  assert.equal(await page.locator('#mobile-menu').getAttribute('aria-expanded'), 'false');
  await nav(page, 'stats');
  assert.equal((await page.locator('#page-title').innerText()).trim(), '学习统计');
});

test('手机上开启专注模式答题时，仍能退出专注模式', async () => {
  const { page } = await openApp(browser, { viewport: MOBILE, storage: { 'g1-preferences': { theme: 'light', font: 'normal', goal: 20, focus: true } } });
  await startPractice(page);
  assert.equal(await page.evaluate(() => document.body.classList.contains('focus-mode')), true);
  const exit = page.locator('#focus-toggle');
  assert.equal(await exit.isVisible(), true, '专注模式下找不到退出按钮');
  await exit.click();
  assert.equal(await page.evaluate(() => document.body.classList.contains('focus-mode')), false);
});

test('深色模式：首页横幅和卡片使用深色背景，文字清晰', async () => {
  const { page } = await openApp(browser, { colorScheme: 'dark', storage: { 'g1-preferences': { theme: 'system', font: 'normal', goal: 20, focus: false } } });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  assert.ok(await luminance(page, 'body') < 0.05);
  assert.ok(await luminance(page, '.hero') < 0.12, '首页横幅在深色模式下仍是浅色');
  for (const selector of ['.stat-card .stat-icon', '.stat-card:nth-child(2) .stat-icon', '.stat-card:nth-child(4) .stat-icon']) {
    assert.ok(await luminance(page, selector) < 0.2, `${selector} 在深色模式下是亮色块`);
  }
});
