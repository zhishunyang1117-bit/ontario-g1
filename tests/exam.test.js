// 模拟考试：抽题构成、交卷前不泄露答案、按两部分各 80% 判定、续考。
const test = require('node:test');
const assert = require('node:assert/strict');
const { sharedBrowser, openApp, read, nav, currentQuestion, confirmModal } = require('./helpers');

const browser = sharedBrowser();

async function startExam(page) {
  await nav(page, 'exam');
  await page.click('[data-action="start-exam"]');
  await page.locator('.question-id').waitFor();
}

// 按计划作答：wrongSigns / wrongRules 道答错，skip 道不答（从交规最后开始）。
async function takeExam(page, { wrongSigns = 0, wrongRules = 0, skip = 0 } = {}) {
  const plan = await page.evaluate(() => JSON.parse(localStorage.getItem('g1-session')).items.map(it => {
    const q = BANK.find(x => x.id === it.id);
    return { section: q.section, answer: q.answer_index };
  }));
  let signs = 0, rules = 0;
  for (let i = 0; i < plan.length - skip; i++) {
    const { section, answer } = plan[i];
    const wrong = section === 'signs' ? signs++ < wrongSigns : rules++ < wrongRules;
    await page.click(`.answer-cell[data-index="${i}"]`);
    await page.click(`.opt[data-option="${wrong ? (answer + 1) % 4 : answer}"]`);
  }
}

test('抽题：20 道标志 + 20 道交规，标志在前', async () => {
  const { page } = await openApp(browser);
  await startExam(page);
  const sections = await page.evaluate(() => JSON.parse(localStorage.getItem('g1-session')).items.map(it => BANK.find(q => q.id === it.id).section));
  assert.equal(sections.length, 40);
  assert.deepEqual(sections, [...Array(20).fill('signs'), ...Array(20).fill('rules')]);
  assert.equal(new Set(await page.evaluate(() => JSON.parse(localStorage.getItem('g1-session')).items.map(it => it.id))).size, 40);
});

test('交卷前不显示对错、解析、笔记和标志描述', async () => {
  const { page } = await openApp(browser);
  await startExam(page);
  for (let i = 0; i < 3; i++) {
    await page.click(`.answer-cell[data-index="${i}"]`);
    await page.locator('.opt').nth(i).click();
    const leak = await page.evaluate(() => ({
      feedback: document.querySelectorAll('.feedback').length,
      marks: document.querySelectorAll('.opt.correct, .opt.incorrect, .answer-cell.correct, .answer-cell.incorrect').length,
      description: document.querySelectorAll('.sign-description').length,
      notes: document.querySelectorAll('#question-note').length,
      alts: [...document.querySelectorAll('.signbox img')].map(img => img.alt),
    }));
    assert.deepEqual({ ...leak, alts: undefined }, { feedback: 0, marks: 0, description: 0, notes: 0, alts: undefined });
    for (const alt of leak.alts) assert.equal(alt, '本题道路标志图片');
  }
  // 图片加载失败时只提示无法加载，不给描述（不是每道标志题都有图片，先跳到有图的一题）
  const withImage = await page.evaluate(() => JSON.parse(localStorage.getItem('g1-session')).items.findIndex(it => BANK.find(q => q.id === it.id).image_url));
  await page.click(`.answer-cell[data-index="${withImage}"]`);
  await page.locator('.sign-fallback:not([hidden])').first().waitFor();
  assert.equal(await page.locator('.sign-description').count(), 0);
  assert.equal(await page.locator('.signbox img').getAttribute('alt'), '本题道路标志图片');
  // 交卷前可以改答案
  await page.click('.answer-cell[data-index="0"]');
  const { answer } = await currentQuestion(page);
  await page.click(`.opt[data-option="${(answer + 2) % 4}"]`);
  await page.click(`.opt[data-option="${answer}"]`);
  assert.equal((await read(page, 'g1-session')).items[0].pick, answer);
});

test('判定：两部分都答对 16/20 才通过', async () => {
  const { page } = await openApp(browser);
  await startExam(page);
  await takeExam(page, { wrongSigns: 4, wrongRules: 4 });
  await page.click('.quiz-actions [data-action="finish"]');
  assert.equal((await page.locator('#page-title').innerText()).trim(), '模拟考试结果');
  assert.match(await page.locator('.result-hero h2').innerText(), /通过/);
  const sessions = await read(page, 'g1-sessions');
  assert.deepEqual(sessions.map(s => [s.mode, s.total, s.correct, s.passed]), [['exam', 40, 32, true]]);
  assert.equal(Object.keys(await read(page, 'g1-wrong')).length, 8);
  assert.equal(await read(page, 'g1-session'), null);
});

test('判定：总分 78% 但交规只对 15/20，不通过', async () => {
  const { page } = await openApp(browser);
  await startExam(page);
  await takeExam(page, { wrongSigns: 4, wrongRules: 5 });
  await page.click('.quiz-actions [data-action="finish"]');
  const parts = await page.locator('.result-parts > div').allInnerTexts();
  assert.match(parts[0], /16 \/ 20/);
  assert.match(parts[1], /15 \/ 20/);
  assert.match(parts[1], /未达到 16/);
  assert.equal((await read(page, 'g1-sessions'))[0].passed, false);
});

test('提前交卷：未答题需要确认，并按未答计入结果', async () => {
  const { page } = await openApp(browser);
  await startExam(page);
  await takeExam(page, { skip: 3 });
  await page.click('.session-summary [data-action="finish"]');
  await page.locator('.modal-card').waitFor();
  assert.match(await page.locator('#confirm-message').innerText(), /还有 3 道题没有作答/);
  await confirmModal(page, true);
  const text = await page.locator('.result-grid').innerText();
  assert.match(text, /37\s*答对/);
  assert.match(text, /3\s*未作答/);
  assert.equal((await read(page, 'g1-sessions'))[0].passed, true);
  assert.equal(await page.locator('.review-item').count(), 3);
});

test('考试中刷新：可以从首页继续，答案和标记都在', async () => {
  const { page } = await openApp(browser);
  await startExam(page);
  await page.locator('.opt').first().click();
  await page.click('[data-action="flag"]');
  await page.click('.answer-cell[data-index="5"]');
  await page.reload();
  await page.locator('.resume-banner').waitFor();
  assert.match(await page.locator('.resume-banner').innerText(), /模拟考试/);
  await page.click('.resume-banner [data-action="resume"]');
  assert.match(await page.locator('.quiz-position').innerText(), /06/);
  assert.equal(await page.locator('.answer-cell.flagged').count(), 1);
  assert.equal(await page.locator('.answer-cell.answered').count(), 1);
});
