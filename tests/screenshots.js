#!/usr/bin/env node
// 截图检查布局：node tests/screenshots.js [输出目录名]
// 在桌面（1280）、手机（390）、深色模式下给主要页面截图，存到 screenshots/（不提交）。
// 用 tests/fixtures 里的旧版备份当作学习记录，让统计、错题等页面有内容。
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, FIXTURES, DESKTOP, MOBILE, launch, openApp, nav, answer, startPractice } = require('./helpers');

const out = path.join(ROOT, 'screenshots', process.argv[2] || 'latest');
const backup = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'backup-v2-original.json'), 'utf8'));
const storage = {
  'g1-hist': backup.hist, 'g1-wrong': backup.wrong, 'g1-bookmarks': backup.bookmarks, 'g1-notes': backup.notes,
  'g1-activity': backup.activity, 'g1-sessions': backup.sessions, 'g1-lang': JSON.stringify('both'),
};
const PAGES = ['home', 'practice', 'exam', 'wrong', 'bookmarks', 'stats', 'settings'];

async function shoot(browser, label, { viewport, theme }) {
  const prefs = { theme, font: 'normal', goal: 20, focus: false };
  const { page, context } = await openApp(browser, { viewport, colorScheme: theme, storage: { ...storage, 'g1-preferences': prefs } });
  const save = name => page.screenshot({ path: path.join(out, `${name}-${label}.png`), fullPage: true });
  await save('home');
  for (const name of PAGES.slice(1)) {
    await nav(page, name);
    await save(name);
  }
  // 一组 10 题的练习：答题页、答错后的解析、结果页
  await startPractice(page);
  await save('quiz');
  await answer(page, false);
  await save('quiz-answered');
  for (let i = 1; i < 10; i++) {
    await page.click('[data-action="next"]');
    await answer(page, i % 3 !== 0);
  }
  await page.click('.quiz-actions [data-action="finish"]');
  await save('result');
  await nav(page, 'exam');
  await page.click('[data-action="start-exam"]');
  await save('exam-quiz');
  await context.close();
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch();
  try {
    await shoot(browser, 'desktop', { viewport: DESKTOP, theme: 'light' });
    await shoot(browser, 'mobile', { viewport: MOBILE, theme: 'light' });
    await shoot(browser, 'dark', { viewport: DESKTOP, theme: 'dark' });
    await shoot(browser, 'mobile-dark', { viewport: MOBILE, theme: 'dark' });
  } finally {
    await browser.close();
  }
  console.log(`截图已保存到 ${path.relative(ROOT, out)}/`);
})();
