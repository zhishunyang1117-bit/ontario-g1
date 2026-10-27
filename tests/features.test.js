// 第三阶段新功能：必背速查、间隔重复（今日复习）、考前冲刺、模拟考历史与趋势、全题库搜索、错题本导出与打印。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { FIXTURES, MOBILE, sharedBrowser, openApp, read, nav, answer, startPractice, confirmModal, noHorizontalScroll } = require('./helpers');

const browser = sharedBrowser();
const dayKey = (offset = 0) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
async function saveDownload(page, click) {
  const [download] = await Promise.all([page.waitForEvent('download'), click()]);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'g1-')), download.suggestedFilename());
  await download.saveAs(file);
  return { name: download.suggestedFilename(), text: fs.readFileSync(file, 'utf8') };
}

// ── 必背速查 ──
test('必背速查：两份资料都内嵌进网页，可切换、按目录跳转', async () => {
  const { page, errors } = await openApp(browser);
  const docs = await page.evaluate(() => REF.docs.map(d => [d.id, d.sections.length]));
  assert.deepEqual(docs.map(d => d[0]), ['cheat', 'info']);
  assert.ok(docs[0][1] >= 20 && docs[1][1] >= 10, JSON.stringify(docs));
  await nav(page, 'reference');
  assert.equal(await page.locator('.ref-section').count(), docs[0][1]);
  assert.equal(await page.locator('.ref-toc a').count(), docs[0][1]);
  assert.match(await page.locator('.ref-content').innerText(), /常用数字速查/);
  // 外部链接新窗口打开
  const links = await page.locator('.ref-content a').evaluateAll(as => as.map(a => [a.target, a.rel, a.href.slice(0, 8)]));
  assert.ok(links.length > 10 && links.every(([t, r, h]) => t === '_blank' && r.includes('noopener') && h === 'https://'));
  await page.locator('.ref-toc a').nth(10).click();
  const top = await page.locator('.ref-section').nth(10).evaluate(el => el.getBoundingClientRect().top);
  assert.ok(top >= 0 && top < 200, `跳转后章节应在屏幕顶部附近（${top}）`);
  await page.click('[data-action="ref-doc"][data-value="info"]');
  assert.equal(await page.locator('.ref-section').count(), docs[1][1]);
  assert.match(await page.locator('.ref-content').innerText(), /笔试形式/);
  assert.deepEqual(errors, []);
});

test('必背速查：搜索只留下命中的段落、表格行和列表，并高亮关键词', async () => {
  const { page } = await openApp(browser);
  await nav(page, 'reference');
  await page.fill('#ref-search', '30 cm');
  const text = await page.locator('.ref-content').innerText();
  assert.match(text, /约 30 cm/);
  assert.doesNotMatch(text, /消防栓/, '不相关的表格行应被筛掉');
  assert.ok(await page.locator('.ref-content mark').count() >= 2);
  // 不写空格、全角字符也能找到
  await page.fill('#ref-search', '３０ｃｍ');
  assert.match(await page.locator('.ref-content').innerText(), /约 30 cm/);
  // 命中小标题时带出下面的整张表
  await page.fill('#ref-search', '扣分表');
  const rows = await page.locator('.ref-section table tbody tr').count();
  assert.ok(rows >= 5, `扣分表应完整显示（${rows} 行）`);
  // 另一份资料也有结果时给出提示
  await page.fill('#ref-search', '扣分');
  assert.match(await page.locator('.ref-summary').innerText(), /考试须知」有 \d+ 处/);
  await page.fill('#ref-search', '完全不存在的词zzz');
  assert.equal(await page.locator('.ref-section').count(), 0);
  assert.match(await page.locator('#view').innerText(), /没有找到相关内容/);
});

// ── 间隔重复 ──
test('今日复习：答错明天再见，答对按间隔推后，同一天重复答对不再加码', async () => {
  const { page } = await openApp(browser);
  await startPractice(page);
  const wrongId = await answer(page, false);
  await page.click('[data-action="next"]');
  const rightId = await answer(page, true);
  let srs = await read(page, 'g1-srs');
  assert.deepEqual(srs[wrongId], { b: 0, d: dayKey(1), l: dayKey() });
  assert.deepEqual(srs[rightId], { b: 2, d: dayKey(4), l: dayKey() });
  // 再练同一道题并答对：间隔不变
  await nav(page, 'bookmarks');
  await page.evaluate(id => { const b = {}; b[id] = true; localStorage.setItem('g1-bookmarks', JSON.stringify(b)); }, rightId);
  await page.reload();
  await nav(page, 'bookmarks');
  await page.click('[data-action="practice-one"]');
  await confirmModal(page, true);
  await answer(page, true);
  srs = await read(page, 'g1-srs');
  assert.deepEqual(srs[rightId], { b: 2, d: dayKey(4), l: dayKey() });
});

test('今日复习：旧版记录升级后自动排期，错题今天到期；复习答对后移出错题本并推后', async () => {
  const original = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'localstorage-original.json'), 'utf8'));
  const wrongIds = Object.keys(JSON.parse(original['g1-wrong']));
  const { page } = await openApp(browser, { storage: original });
  const srs = await read(page, 'g1-srs');
  assert.ok(srs, '应自动生成复习计划');
  for (const id of wrongIds) assert.equal(srs[id].d, dayKey(), `${id} 应今天到期`);
  assert.equal(Object.keys(srs).length, Object.keys(JSON.parse(original['g1-hist'])).length);
  const card = page.locator('.review-card');
  assert.match(await card.innerText(), new RegExp(`${wrongIds.length}\\s*道题今天该复习`));
  await page.click('[data-action="start-review"]');
  await confirmModal(page, true);
  const session = await read(page, 'g1-session');
  assert.equal(session.mode, 'review');
  assert.deepEqual(session.items.map(it => it.id).sort(), wrongIds.slice().sort());
  assert.match(await page.locator('#page-title').innerText(), /今日复习/);
  const first = await answer(page, true);
  assert.equal((await read(page, 'g1-wrong'))[first], undefined, '复习答对应移出错题本');
  assert.equal((await read(page, 'g1-srs'))[first].d, dayKey(2));
  await page.click('[data-action="pause"]');
  assert.match(await page.locator('.review-card').innerText(), new RegExp(`${wrongIds.length - 1}\\s*道题今天该复习`));
});

test('今日复习：过期没复习的题也算到期，超过 20 题时可以只复习 20 题或全部', async () => {
  const ids = await (await openApp(browser)).page.evaluate(() => BANK.slice(0, 25).map(q => q.id));
  const srs = Object.fromEntries(ids.map((id, i) => [id, { b: 1, d: dayKey(-1 - (i % 3)), l: dayKey(-3) }]));
  srs[ids[24]] = { b: 3, d: dayKey(3), l: dayKey() };
  const hist = Object.fromEntries(ids.map(id => [id, { c: 1, w: 1 }]));
  const { page } = await openApp(browser, { storage: { 'g1-srs': srs, 'g1-hist': hist } });
  assert.match(await page.locator('.review-card').innerText(), /24\s*道题今天该复习/);
  await page.click('[data-action="start-review"]');
  assert.equal((await read(page, 'g1-session')).items.length, 20);
  await page.click('[data-action="pause"]');
  await page.click('[data-action="start-review-all"]');
  await confirmModal(page, true);
  assert.equal((await read(page, 'g1-session')).items.length, 24);
});

// ── 考前冲刺 ──
test('考前冲刺：跳过已掌握的题，错题和没掌握的题优先，答对移出错题本', async () => {
  const { page } = await openApp(browser, { storage: {
    'g1-hist': { 'LA-01': { c: 3, w: 0 }, 'LA-02': { c: 0, w: 2 }, 'LA-03': { c: 1, w: 2 }, 'SA-04': { c: 0, w: 1 } },
    'g1-wrong': { 'LA-02': 2, 'SA-04': 1 },
  } });
  await nav(page, 'sprint');
  const tiles = await page.locator('.sprint-tile').allInnerTexts();
  assert.match(tiles[0], /^2\s/);
  assert.match(tiles[1], /^1\s/);
  await page.locator('#sprint-unseen').uncheck({ force: true });
  await page.click('[data-action="sprint-count"][data-value="all"]');
  assert.match(await page.locator('.setup-footer').innerText(), /本次冲刺 3 题/);
  await page.click('[data-action="start-sprint"]');
  const session = await read(page, 'g1-session');
  assert.equal(session.mode, 'sprint');
  assert.deepEqual(session.items.map(it => it.id).sort(), ['LA-02', 'LA-03', 'SA-04']);
  for (let i = 0; i < 3; i++) {
    await answer(page, true);
    if (i < 2) await page.click('[data-action="next"]');
  }
  assert.deepEqual(await read(page, 'g1-wrong'), {});
  // 打开“没练过的题”后，错题仍排在最前
  await nav(page, 'sprint');
  await page.click('[data-action="sprint-section"][data-value="all"]');
  await page.locator('#sprint-unseen').check({ force: true });
  await page.click('[data-action="sprint-count"][data-value="20"]');
  await page.click('[data-action="start-sprint"]');
  await confirmModal(page, true);
  const next = await read(page, 'g1-session');
  assert.equal(next.items.length, 20);
  assert.ok(!next.items.some(it => it.id === 'LA-01'), '已掌握的题不应出现');
});

// ── 模拟考历史 ──
test('模拟考历史：按交卷时间画趋势图，旧记录没有分部分成绩时显示“—”', async () => {
  const now = Date.now(), day = 86400000;
  const exams = [
    { id: 'b', mode: 'exam', total: 40, correct: 34, answered: 40, duration: 900, finishedAt: now - day, passed: true, signs: { c: 18, n: 20 }, rules: { c: 16, n: 20 } },
    { id: 'a', mode: 'exam', total: 40, correct: 28, answered: 40, duration: 800, finishedAt: now - 3 * day, passed: false },
    { id: 'c', mode: 'exam', total: 40, correct: 31, answered: 40, duration: 700, finishedAt: now, passed: false, signs: { c: 19, n: 20 }, rules: { c: 12, n: 20 } },
  ];
  const { page } = await openApp(browser, { storage: { 'g1-sessions': exams } });
  await nav(page, 'exam');
  const points = page.locator('.trend-point');
  assert.equal(await points.count(), 3);
  const labels = await points.evaluateAll(els => els.map(el => [el.className.includes('pass') ? 'pass' : 'fail', el.getAttribute('aria-label')]));
  assert.deepEqual(labels.map(l => l[0]), ['fail', 'pass', 'fail'], '应按交卷时间从早到晚排列');
  assert.match(labels[1][1], /85%.*通过.*标志 18\/20.*交规 16\/20/);
  // 成绩都不低于 40% 时纵轴从 40 起（70% 的点在一半高度）；有更低的成绩时从 0 起
  assert.deepEqual(await page.locator('.trend-chart .chart-gridlines em').allInnerTexts(), ['100', '60', '40']);
  assert.equal(await points.first().evaluate(el => el.style.bottom), '50%');
  const low = await openApp(browser, { storage: { 'g1-sessions': [{ ...exams[1], correct: 12 }] } });
  await nav(low.page, 'exam');
  assert.deepEqual(await low.page.locator('.trend-chart .chart-gridlines em').allInnerTexts(), ['100', '60', '40', '20', '0']);
  await low.context.close();
  await page.click('.exam-history .chart-table summary');
  const rows = await page.locator('.exam-history tbody tr').allInnerTexts();
  assert.equal(rows.length, 3);
  assert.match(rows[2], /70%\s+—\s+—\s+未通过/);
  // 真正交一次卷，会记下两部分的分数
  await page.click('[data-action="start-exam"]');
  const plan = await page.evaluate(() => JSON.parse(localStorage.getItem('g1-session')).items.map(it => BANK.find(q => q.id === it.id).answer_index));
  for (let i = 0; i < 40; i++) {
    await page.click(`.answer-cell[data-index="${i}"]`);
    await page.click(`.opt[data-option="${i % 10 === 0 ? (plan[i] + 1) % 4 : plan[i]}"]`);
  }
  await page.click('.quiz-actions [data-action="finish"]');
  const last = (await read(page, 'g1-sessions')).at(-1);
  assert.deepEqual([last.signs, last.rules, last.passed], [{ c: 18, n: 20 }, { c: 18, n: 20 }, true]);
  await nav(page, 'exam');
  assert.equal(await page.locator('.trend-point').count(), 4);
});

// ── 全题库搜索 ──
test('题库搜索：题干、选项、解析都能搜，中英文、大小写、全角半角都行', async () => {
  const { page } = await openApp(browser);
  await page.click('#search-button');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'bank-search');
  const ids = () => page.locator('.search-result .question-meta > span:nth-child(2)').allInnerTexts();
  await page.fill('#bank-search', '最低年龄');
  assert.ok((await ids()).includes('LA-01'));
  await page.fill('#bank-search', 'MINIMUM age');
  assert.ok((await ids()).includes('LA-01'));
  // 只出现在解析里的句子片段
  const target = await page.evaluate(() => BANK.find(x => x.id === 'LA-01').explanation_zh.slice(10, 22));
  await page.fill('#bank-search', target);
  assert.ok((await ids()).includes('LA-01'), target);
  assert.match(await page.locator('.search-result').first().locator('.match-where').innerText(), /解析/);
  assert.ok(await page.locator('.search-result mark').count() > 0);
  // 全角输入
  await page.fill('#bank-search', 'ＳＣＨＯＯＬ ＢＵＳ');
  const fullWidth = await ids();
  await page.fill('#bank-search', 'school bus');
  assert.deepEqual(await ids(), fullWidth);
  assert.ok(fullWidth.length > 0);
  // 范围筛选
  await page.click('[data-action="bank-section"][data-value="signs"]');
  const chips = await page.locator('.search-result .chip').evaluateAll(els => els.map(el => el.className));
  assert.ok(chips.every(c => c.includes('signs')));
  await page.click('[data-action="bank-section"][data-value="all"]');
  // 分页
  await page.fill('#bank-search', '驾照');
  assert.match(await page.locator('.list-head').innerText(), /找到 (\d+) 道题/);
  const total = Number((await page.locator('.list-head').innerText()).match(/找到 (\d+)/)[1]);
  assert.ok(total > 20);
  await page.click('[data-action="bank-next"]');
  assert.match(await page.locator('.pagination').innerText(), /2 \//);
  // 从搜索结果直接练这道题
  const firstId = (await ids())[0];
  await page.locator('.search-result [data-action="practice-one"]').first().click();
  assert.equal((await page.locator('.question-id').innerText()).trim(), firstId);
});

test('题库搜索：拼音输入法组字时不打断', async () => {
  const { page } = await openApp(browser);
  await nav(page, 'search');
  const survived = await page.evaluate(() => {
    const input = document.getElementById('bank-search');
    input.focus();
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    input.value = 'xiao';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    const same = document.getElementById('bank-search') === input;
    input.value = '校车';
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '校车' }));
    return same;
  });
  assert.equal(survived, true);
  assert.ok(await page.locator('.search-result').count() > 0);
});

// ── 错题本导出与打印 ──
const wrongStorage = {
  'g1-wrong': { 'LA-01': 2, 'SA-04': 1, 'RB-20': 3 },
  'g1-hist': { 'LA-01': { c: 0, w: 2 }, 'SA-04': { c: 0, w: 1 }, 'RB-20': { c: 1, w: 3 } },
  'g1-notes': { 'LA-01': '笔记含逗号, 引号"和\n换行' },
};

test('错题本导出 Markdown 和 CSV：含答案、解析、答错次数和笔记，CSV 可直接用 Excel 打开', async () => {
  const { page } = await openApp(browser, { storage: wrongStorage });
  await nav(page, 'wrong');
  const md = await saveDownload(page, () => page.click('[data-action="export-md"]'));
  assert.match(md.name, /^G1-错题本-\d{4}-\d{2}-\d{2}\.md$/);
  for (const id of ['LA-01', 'SA-04', 'RB-20']) assert.match(md.text, new RegExp(`## \\d+\\. ${id}`));
  assert.match(md.text, /\*\*答案：B\*\*/);
  assert.equal((md.text.match(/✅/g) || []).length, 3);
  assert.match(md.text, /累计答错 3 次/);
  assert.match(md.text, /我的笔记：.*笔记含逗号/);
  assert.match(md.text, /!\[.*\]\(https:\/\/files\.ontario\.ca\//);
  const csv = await saveDownload(page, () => page.click('[data-action="export-csv"]'));
  assert.ok(csv.text.startsWith('﻿"题号"'), 'CSV 应带 BOM，方便 Excel 识别中文');
  const lines = csv.text.trim().split('\r\n');
  assert.equal(lines.length, 1 + 3, '笔记里的换行在引号内，不会拆成新的一行');
  assert.match(csv.text, /"笔记含逗号, 引号""和\n换行"/);
  // 只导出筛选后的题
  await page.fill('#collection-search', 'LA-01');
  const filtered = await saveDownload(page, () => page.click('[data-action="export-csv"]'));
  assert.equal(filtered.text.trim().split('\r\n').length, 1 + 1);
});

test('错题本打印：含答案版标出正确选项和解析，练习卷不带答案、答案附在最后', async () => {
  const { page } = await openApp(browser, { storage: wrongStorage });
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await nav(page, 'wrong');
  await page.click('[data-action="print-answers"]');
  // SA-04、RB-20 带标志图片：等图片加载结果出来才打开打印窗口；加载失败的图片去掉，只留文字说明
  await page.waitForFunction(() => window.__printed === 1);
  assert.equal(await page.evaluate(() => document.body.classList.contains('print-questions')), true);
  assert.equal(await page.locator('#print-sheet .print-q').count(), 3);
  assert.equal(await page.locator('#print-sheet .is-answer').count(), 3);
  assert.match(await page.locator('#print-sheet').innerText(), /答案 B/);
  assert.equal(await page.locator('#print-sheet img').count(), 0);
  assert.equal(await page.locator('#print-sheet .print-sign').count(), 2);
  assert.match(await page.locator('#print-sheet .print-sign').first().innerText(), /图示：\S/);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert.equal(await page.evaluate(() => document.body.classList.contains('print-questions')), false);
  await page.click('[data-action="print-blank"]');
  await page.waitForFunction(() => window.__printed === 2);
  assert.equal(await page.locator('#print-sheet .is-answer').count(), 0);
  assert.equal(await page.locator('#print-sheet .print-explain').count(), 0);
  assert.match(await page.locator('#print-sheet .print-key').innerText(), /1\. [A-D]/);
  // 打印时只显示打印区域
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('#print-sheet').isVisible(), true);
  assert.equal(await page.locator('.app-main').isVisible(), false);
});

test('联网打印：标志图片加载完才打开打印窗口，等待时重复点击只打印一次', async () => {
  const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  const context = await (await browser()).newContext({ viewport: { width: 1280, height: 900 } });
  let release;
  const imagesArrive = new Promise(resolve => { release = resolve; });
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith('https://files.ontario.ca/')) { await imagesArrive; return route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }); }
    return /^(file|data|blob):/.test(url) ? route.continue() : route.abort();
  });
  try {
    const { page } = await openApp(browser, { context, storage: wrongStorage });
    await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await nav(page, 'wrong');
    await page.click('[data-action="print-answers"]');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__printed), 0, '图片还在加载时不应打开打印窗口');
    await page.click('[data-action="print-answers"]');
    release();
    await page.waitForFunction(() => window.__printed > 0);
    assert.equal(await page.evaluate(() => document.querySelector('#print-sheet img')?.naturalWidth), 1);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__printed), 1);
  } finally {
    await context.close();
  }
});

// ── 备份与布局 ──
test('备份包含复习计划；导入没有复习计划的旧备份时按导入的记录重新排期', async () => {
  const { page } = await openApp(browser);
  await startPractice(page);
  const id = await answer(page, false);
  await nav(page, 'settings');
  const backup = await saveDownload(page, () => page.click('[data-action="export"]'));
  assert.deepEqual(JSON.parse(backup.text).srs[id], { b: 0, d: dayKey(1), l: dayKey() });
  await page.setInputFiles('#import-file', path.join(FIXTURES, 'backup-v2-original.json'));
  await confirmModal(page, true);
  const original = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'backup-v2-original.json'), 'utf8'));
  const srs = await read(page, 'g1-srs');
  assert.equal(Object.keys(srs).length, Object.keys(original.hist).length);
  for (const wid of Object.keys(original.wrong)) assert.equal(srs[wid].d, dayKey());
});

test('手机宽度：新页面不横向滚动，速查表格改成卡片排版', async () => {
  const { page } = await openApp(browser, { viewport: MOBILE, storage: { 'g1-sessions': [{ id: 'x', mode: 'exam', total: 40, correct: 39, answered: 40, duration: 900, finishedAt: Date.now(), passed: true, signs: { c: 20, n: 20 }, rules: { c: 19, n: 20 } }] } });
  for (const name of ['sprint', 'reference', 'search', 'exam', 'stats']) {
    await nav(page, name);
    await noHorizontalScroll(page, name);
  }
  await nav(page, 'reference');
  await page.fill('#ref-search', '扣分');
  await noHorizontalScroll(page, '速查搜索');
  const display = await page.locator('.ref-table.cols-3 tr').first().evaluate(el => getComputedStyle(el).display);
  assert.equal(display, 'block');
  await nav(page, 'search');
  await page.fill('#bank-search', 'school bus');
  await noHorizontalScroll(page, '搜索结果');
});
