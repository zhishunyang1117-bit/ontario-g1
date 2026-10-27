// 学习记录：旧版数据兼容、导出导入、刷新续练、多窗口、计时、偏好设置、统计和清空。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { FIXTURES, sharedBrowser, openApp, read, nav, answer, startPractice, confirmModal } = require('./helpers');

const browser = sharedBrowser();

const fixture = name => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
const tmpFile = (name, value) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'g1-')), name);
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  return file;
};

async function importFile(page, file) {
  await nav(page, 'settings');
  await page.setInputFiles('#import-file', file);
}

test('旧版留在浏览器里的学习记录升级后照常可用', async () => {
  const original = fixture('localstorage-original.json');
  const { page, errors } = await openApp(browser, { storage: original });
  const hist = JSON.parse(original['g1-hist']);
  const text = await page.locator('.stat-grid').innerText();
  assert.match(text, new RegExp(`${Object.keys(hist).length}\\s*/\\s*723`));
  assert.match(text, new RegExp(String(Object.keys(JSON.parse(original['g1-wrong'])).length)));
  // 未完成的练习可以继续
  await page.click('.resume-banner [data-action="resume"]');
  const saved = JSON.parse(original['g1-session']);
  assert.match(await page.locator('.quiz-position').innerText(), new RegExp(String(saved.i + 1).padStart(2, '0')));
  assert.equal(await page.locator('.answer-cell.flagged').count(), 1);
  // 分类练习的题量和章节选择沿用旧设置
  await nav(page, 'practice');
  assert.equal(await page.locator('[data-action="practice-count"][aria-pressed="true"]').getAttribute('data-value'), '40');
  assert.equal(await page.locator('input[data-group-select="RE"]').isChecked(), false);
  // 偏好：深色、大字号、中文
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.font), 'large');
  assert.equal(await page.locator('#lang-zh').getAttribute('aria-pressed'), 'true');
  await nav(page, 'stats');
  assert.match(await page.locator('#view').innerText(), /模拟考试/);
  assert.deepEqual(errors, []);
});

test('导出备份：包含全部学习记录，可被再次导入', async () => {
  const { page } = await openApp(browser);
  await startPractice(page);
  const id = await answer(page, false);
  await page.click('.question-tools [data-action="bookmark"]');
  await page.locator('.notes-box summary').click();
  await page.fill('#question-note', '导出测试');
  await nav(page, 'settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export"]')]);
  assert.match(download.suggestedFilename(), /^Ontario-G1-学习备份-\d{4}-\d{2}-\d{2}\.json$/);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'g1-')), 'export.json');
  await download.saveAs(file);
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(backup.app, 'ontario-g1');
  assert.ok([2, 3].includes(backup.version));
  assert.deepEqual(backup.hist[id], { c: 0, w: 1 });
  assert.equal(backup.wrong[id], 1);
  assert.equal(backup.bookmarks[id], true);
  assert.equal(backup.notes[id], '导出测试');
  assert.equal(backup.session.items.length, 10);
  // 在一个全新的浏览器里导入
  const fresh = await openApp(browser);
  await importFile(fresh.page, file);
  await confirmModal(fresh.page, true);
  assert.deepEqual((await read(fresh.page, 'g1-hist'))[id], { c: 0, w: 1 });
  assert.equal((await read(fresh.page, 'g1-notes'))[id], '导出测试');
  assert.equal(await fresh.page.locator('.resume-banner').count(), 1);
});

test('导入原版网页导出的备份文件', async () => {
  const backup = fixture('backup-v2-original.json');
  const { page } = await openApp(browser);
  await importFile(page, path.join(FIXTURES, 'backup-v2-original.json'));
  await page.locator('.modal-card').waitFor();
  assert.match(await page.locator('#confirm-message').innerText(), new RegExp(`${Object.keys(backup.hist).length} 道题的练习记录`));
  await confirmModal(page, true);
  assert.deepEqual(await read(page, 'g1-hist'), backup.hist);
  assert.deepEqual(await read(page, 'g1-wrong'), backup.wrong);
  assert.deepEqual(await read(page, 'g1-bookmarks'), backup.bookmarks);
  assert.deepEqual(await read(page, 'g1-notes'), backup.notes);
  assert.equal((await read(page, 'g1-sessions')).length, backup.sessions.length);
  assert.equal((await read(page, 'g1-preferences')).theme, 'dark');
  assert.equal(await read(page, 'g1-lang'), 'zh');
  await page.click('.resume-banner [data-action="resume"]');
  assert.equal(await page.locator('.answer-cell.answered').count(), 2);
});

test('导入不带偏好设置的 v1 备份：替换学习记录，保留当前的外观设置', async () => {
  const { page } = await openApp(browser, { storage: { 'g1-preferences': { theme: 'dark', font: 'large', goal: 40, focus: true }, 'g1-lang': JSON.stringify('en') } });
  await importFile(page, path.join(FIXTURES, 'backup-v1.json'));
  await confirmModal(page, true);
  assert.deepEqual(await read(page, 'g1-preferences'), { theme: 'dark', font: 'large', goal: 40, focus: true });
  assert.equal(await read(page, 'g1-lang'), 'en');
  assert.deepEqual(Object.keys(await read(page, 'g1-hist')).sort(), ['LA-01', 'RB-20', 'SA-04']);
  assert.deepEqual(await read(page, 'g1-wrong'), { 'SA-04': 2 });
});

test('导入无效文件：给出提示，不改动现有记录', async () => {
  const { page } = await openApp(browser, { storage: { 'g1-hist': { 'LA-01': { c: 1, w: 0 } } } });
  for (const bad of ['not json', { app: 'other', version: 2, hist: {} }, { app: 'ontario-g1', version: 99, hist: {} }, { app: 'ontario-g1', version: 2, hist: [] }]) {
    await importFile(page, tmpFile('bad.json', bad));
    await page.locator('#toast.visible').waitFor();
    assert.match(await page.locator('#toast').innerText(), /无法读取/);
    assert.equal(await page.locator('.modal-card').count(), 0);
  }
  assert.deepEqual(await read(page, 'g1-hist'), { 'LA-01': { c: 1, w: 0 } });
});

test('刷新后续练：位置、答案、标记都保留，已答题不会重复计分', async () => {
  const { page } = await openApp(browser);
  await startPractice(page);
  await answer(page, true);
  await page.click('[data-action="next"]');
  await answer(page, false);
  await page.click('[data-action="flag"]');
  await page.reload();
  assert.match(await page.locator('.resume-banner').innerText(), /已答 2 \/ 10/);
  await page.click('.resume-banner [data-action="resume"]');
  assert.match(await page.locator('.quiz-position').innerText(), /02/);
  assert.equal(await page.locator('.feedback').count(), 1);
  const histBefore = await read(page, 'g1-hist');
  await page.keyboard.press('1');
  assert.deepEqual(await read(page, 'g1-hist'), histBefore);
});

test('同时打开两个窗口：一个窗口的答题记录不会被另一个窗口覆盖', async () => {
  const first = await openApp(browser);
  await startPractice(first.page);
  await answer(first.page, true);
  await first.page.click('[data-action="next"]');
  // 第二个窗口开一组新练习，答 3 题
  const second = await openApp(browser, { context: first.context });
  await nav(second.page, 'practice');
  await second.page.click('[data-action="start-practice"]');
  await confirmModal(second.page, true);
  for (let i = 0; i < 3; i++) {
    await answer(second.page, false);
    await second.page.click('[data-action="next"]');
  }
  // 回到第一个窗口继续答题
  await answer(first.page, true);
  const attempts = Object.values(await read(first.page, 'g1-hist')).reduce((n, h) => n + h.c + h.w, 0);
  assert.equal(attempts, 5, '第一个窗口用旧数据覆盖了第二个窗口的答题记录');
  assert.equal(Object.values(await read(first.page, 'g1-wrong')).reduce((n, v) => n + v, 0), 3);
  assert.equal(await first.page.locator('[data-count="wrong"]').first().innerText(), '3');
});

test('计时：页面切到后台时暂停，超过一小时显示时:分:秒', async () => {
  const { page } = await openApp(browser, { storage: { 'g1-sessions': [{ id: 'a', mode: 'practice', total: 20, correct: 15, answered: 20, duration: 3800, finishedAt: Date.now(), passed: false }] } });
  await nav(page, 'stats');
  assert.match(await page.locator('.history-row').first().innerText(), /1:03:20/);
  await startPractice(page);
  await page.evaluate(() => {
    const set = hidden => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    set(true);
    const realNow = Date.now;
    Date.now = () => realNow() + 10 * 60 * 1000;
    set(false);
  });
  await page.waitForTimeout(1100);
  const label = await page.locator('#session-timer').innerText();
  assert.match(label, /^00:0\d$/, `后台时间被计入：${label}`);
});

test('偏好设置：深浅色、跟随系统、大字号、专注模式、每日目标，刷新后保留', async () => {
  const { page } = await openApp(browser, { colorScheme: 'dark' });
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  await nav(page, 'settings');
  await page.click('[data-action="theme"][data-value="dark"]');
  assert.equal(await theme(), 'dark');
  await page.click('[data-action="theme"][data-value="light"]');
  assert.equal(await theme(), 'light');
  await page.click('[data-action="theme"][data-value="system"]');
  assert.equal(await theme(), 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.click('[data-action="font"][data-value="large"]');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.font), 'large');
  await page.locator('#settings-focus').check({ force: true });
  await page.fill('#settings-goal', '35');
  await page.locator('#settings-goal').blur();
  await page.reload();
  assert.deepEqual(await read(page, 'g1-preferences'), { theme: 'system', font: 'large', goal: 35, focus: true });
  assert.match(await page.locator('.daily-card').innerText(), /\/\s*35/);
  await startPractice(page);
  assert.equal(await page.evaluate(() => document.body.classList.contains('focus-mode')), true);
  assert.equal(await page.locator('#sidebar').isVisible(), false);
  await page.click('#focus-toggle');
  assert.equal(await page.locator('#sidebar').isVisible(), true);
});

test('学习统计：累计作答、正确率、覆盖、连续天数和模拟通过次数', async () => {
  const today = new Date(); const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const { page } = await openApp(browser, { storage: {
    'g1-hist': { 'LA-01': { c: 2, w: 1 }, 'SA-04': { c: 0, w: 3 }, 'RB-20': { c: 1, w: 0 } },
    'g1-activity': { [key(yesterday)]: { c: 1, w: 2 }, [key(today)]: { c: 2, w: 2 } },
    'g1-sessions': [{ id: 'x', mode: 'exam', total: 40, correct: 34, answered: 40, duration: 900, finishedAt: Date.now(), passed: true }, { id: 'y', mode: 'exam', total: 40, correct: 20, answered: 40, duration: 900, finishedAt: Date.now(), passed: false }],
  } });
  await nav(page, 'stats');
  const text = await page.locator('.stat-grid').innerText();
  assert.match(text, /累计作答\s*7/);
  assert.match(text, /43\s*%/);
  assert.match(text, /2\s*天/);
  assert.match(text, /1\s*\/\s*2/);
  assert.match(await page.locator('#view').innerText(), /3\s*\/\s*723/);
});

test('清空练习记录：成绩、错题、统计清零，收藏和笔记保留', async () => {
  const { page } = await openApp(browser, { storage: { 'g1-hist': { 'LA-01': { c: 1, w: 1 } }, 'g1-wrong': { 'LA-01': 1 }, 'g1-bookmarks': { 'LA-02': true }, 'g1-notes': { 'LA-02': '保留' } } });
  await nav(page, 'settings');
  await page.click('[data-action="reset"]');
  await confirmModal(page, true);
  assert.deepEqual(await read(page, 'g1-hist'), {});
  assert.deepEqual(await read(page, 'g1-wrong'), {});
  assert.deepEqual(await read(page, 'g1-bookmarks'), { 'LA-02': true });
  assert.deepEqual(await read(page, 'g1-notes'), { 'LA-02': '保留' });
});
