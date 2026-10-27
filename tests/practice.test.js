// 首页、分类练习、答题、收藏/笔记/标记/答题卡、快捷键、错题复习、标志图片兜底。
const test = require('node:test');
const assert = require('node:assert/strict');
const { sharedBrowser, openApp, read, nav, currentQuestion, answer, startPractice, confirmModal } = require('./helpers');

const browser = sharedBrowser();

// 1×1 像素 PNG：拦截官方图片请求并返回它，用来模拟“图片加载成功”。
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

test('首页显示题库规模和空白状态下的统计', async () => {
  const { page, errors } = await openApp(browser);
  assert.equal((await page.locator('#page-title').innerText()).trim(), '学习总览');
  const text = await page.locator('#view').innerText();
  assert.match(text, /723/);
  assert.match(text, /0\s*\/\s*723/);
  assert.deepEqual(errors, []);
});

test('分类练习：部分、难度、题量、随机与只练未掌握的筛选都生效', async () => {
  const { page } = await openApp(browser);
  await nav(page, 'practice');
  const poolText = () => page.locator('.pool-count').innerText();
  assert.match(await poolText(), /^723/);
  await page.click('[data-action="category-section"][data-value="signs"]');
  assert.match(await poolText(), /^212/);
  await page.click('[data-action="category-section"][data-value="all"]');
  await page.click('[data-action="practice-difficulty"][data-value="hard"]');
  assert.match(await poolText(), /^76/);
  await page.click('[data-action="practice-difficulty"][data-value="all"]');
  await page.fill('#category-search', '警告');
  assert.equal(await page.locator('.category-card').count(), 1);
  await page.fill('#category-search', '');
  // 只选一个章节、关闭随机：题目按题库顺序出现
  await page.click('[data-action="select-none"]');
  await page.locator('input[data-group-select="LA"]').check({ force: true });
  await page.locator('#practice-random').uncheck({ force: true });
  await page.click('[data-action="practice-count"][data-value="10"]');
  await page.click('[data-action="start-practice"]');
  const session = await read(page, 'g1-session');
  const expected = await page.evaluate(() => BANK.filter(q => q.group === 'LA').slice(0, 10).map(q => q.id));
  assert.deepEqual(session.items.map(it => it.id), expected);
  // 掌握第一题后，“只练未掌握”的题池少 1
  await answer(page, true);
  await nav(page, 'practice');
  const before = parseInt(await poolText(), 10);
  await page.locator('#practice-unmastered').check({ force: true });
  assert.equal(parseInt(await poolText(), 10), before - 1);
  assert.equal(await read(page, 'g1-unseen'), true);
});

test('答题：即时解析，并记录成绩、错题和每日练习量', async () => {
  const { page } = await openApp(browser);
  await startPractice(page);
  const right = await answer(page, true);
  assert.match(await page.locator('.feedback').innerText(), /回答正确/);
  assert.equal(await page.locator('.opt.correct').count(), 1);
  await page.click('[data-action="next"]');
  const wrongId = await answer(page, false);
  assert.match(await page.locator('.feedback').innerText(), /正确答案 [A-D]/);
  assert.equal(await page.locator('.opt.incorrect').count(), 1);
  const hist = await read(page, 'g1-hist');
  assert.deepEqual(hist[right], { c: 1, w: 0 });
  assert.deepEqual(hist[wrongId], { c: 0, w: 1 });
  assert.deepEqual(Object.keys(await read(page, 'g1-wrong')), [wrongId]);
  const activity = await read(page, 'g1-activity');
  assert.deepEqual(Object.values(activity), [{ c: 1, w: 1 }]);
  assert.equal(await page.locator('[data-count="wrong"]').first().innerText(), '1');
});

test('收藏、笔记、标记回看和答题卡跳转', async () => {
  const { page } = await openApp(browser);
  await startPractice(page);
  const { id } = await currentQuestion(page);
  await page.click('.question-tools [data-action="bookmark"]');
  assert.deepEqual(await read(page, 'g1-bookmarks'), { [id]: true });
  // 标记、收藏会重绘页面，已打开（还没写字）的笔记框不应被收起
  await page.locator('.notes-box summary').click();
  await page.click('[data-action="flag"]');
  assert.equal(await page.locator('.notes-box[open]').count(), 1);
  await page.fill('#question-note', '记住：先看标志形状');
  assert.equal((await read(page, 'g1-notes'))[id], '记住：先看标志形状');
  assert.equal(await page.locator('.answer-cell.flagged').count(), 1);
  await page.click('.answer-cell[data-index="4"]');
  assert.match(await page.locator('.quiz-position').innerText(), /05/);
  await page.click('[data-action="jump-flagged"]');
  assert.match(await page.locator('.quiz-position').innerText(), /01/);
  await answer(page, true);
  await page.click('[data-action="jump-unanswered"]');
  assert.match(await page.locator('.quiz-position').innerText(), /02/);
  await nav(page, 'bookmarks');
  assert.equal(await page.locator('.review-row').count(), 1);
});

test('快捷键：数字/字母选答案、Enter 下一题、Shift+B 收藏，答题后焦点在按钮上也有效', async () => {
  const { page } = await openApp(browser);
  await startPractice(page);
  const first = await currentQuestion(page);
  await page.keyboard.press('2');
  const session = await read(page, 'g1-session');
  assert.equal(session.items[0].order.indexOf(session.items[0].pick), 1, '按 2 应选第二个选项');
  // 答完后焦点自动移到“下一题”，此时 Shift+B 仍应收藏
  await page.keyboard.press('Shift+B');
  assert.deepEqual(await read(page, 'g1-bookmarks'), { [first.id]: true });
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.quiz-position').innerText(), /02/);
  await page.keyboard.press('c');
  const after = await read(page, 'g1-session');
  assert.equal(after.items[1].order.indexOf(after.items[1].pick), 2, '按 C 应选第三个选项');
  // 在笔记里打字不会触发答题
  await page.keyboard.press('Enter');
  await page.locator('.notes-box summary').click();
  await page.locator('#question-note').type('a1');
  assert.equal((await read(page, 'g1-session')).items[2].pick, null);
});

test('快捷键：模拟考试里先用鼠标点选，再用键盘改答案和翻页', async () => {
  const { page } = await openApp(browser);
  await nav(page, 'exam');
  await page.click('[data-action="start-exam"]');
  await page.locator('.opt').first().click();
  await page.keyboard.press('3');
  let session = await read(page, 'g1-session');
  assert.equal(session.items[0].order.indexOf(session.items[0].pick), 2, '鼠标点选后按 3 应改选第三项');
  await page.keyboard.press('Enter');
  session = await read(page, 'g1-session');
  assert.equal(session.i, 1, 'Enter 应进入下一题');
});

test('错题复习：答对后自动移出错题本，答错的留下', async () => {
  const seeded = { 'LA-01': 2, 'LA-02': 1 };
  const { page } = await openApp(browser, { storage: { 'g1-wrong': seeded, 'g1-hist': { 'LA-01': { c: 0, w: 2 }, 'LA-02': { c: 0, w: 1 } } } });
  await nav(page, 'wrong');
  assert.equal(await page.locator('.review-row').count(), 2);
  await page.fill('#collection-search', 'LA-02');
  assert.equal(await page.locator('.review-row').count(), 1);
  await page.fill('#collection-search', '');
  await page.click('[data-action="start-collection"]');
  const first = await answer(page, true);
  await page.click('[data-action="next"]');
  const second = await answer(page, false);
  const wrong = await read(page, 'g1-wrong');
  assert.equal(wrong[first], undefined);
  assert.equal(wrong[second], seeded[second] + 1);
});

test('结果页：展开错题后点收藏，展开状态保持', async () => {
  const { page } = await openApp(browser);
  await startPractice(page);
  for (let i = 0; i < 10; i++) {
    await answer(page, i > 1);
    await page.click(i < 9 ? '[data-action="next"]' : '.quiz-actions [data-action="finish"]');
  }
  assert.equal((await page.locator('#page-title').innerText()).trim(), '练习完成');
  assert.equal(await page.locator('.review-item').count(), 2);
  await page.locator('.review-item summary').first().click();
  await page.locator('.review-item[open] [data-action="bookmark-id"]').click();
  assert.equal(await page.locator('.review-item[open]').count(), 1);
  assert.equal(Object.keys(await read(page, 'g1-bookmarks')).length, 1);
});

test('标志图片加载失败：练习显示文字描述，可重试；重绘时不重复请求失败的图片', async () => {
  const { page, external } = await openApp(browser, { storage: { 'g1-wrong': { 'SA-04': 1 } } });
  await nav(page, 'wrong');
  await page.click('[data-action="practice-one"]');
  await page.locator('.sign-fallback:not([hidden])').waitFor();
  assert.equal(await page.locator('.signbox img').isHidden(), true);
  assert.equal(await page.locator('.sign-description').isVisible(), true, '图片失败时练习模式应显示文字描述');
  const requests = external.length;
  await page.click('.question-tools [data-action="bookmark"]');
  await page.click('[data-action="flag"]');
  assert.equal(external.length, requests, '收藏/标记重绘不应重新请求已失败的图片');
  assert.equal(await page.locator('.sign-fallback').isVisible(), true);
  await page.click('[data-action="retry-image"]');
  await page.locator('.sign-fallback:not([hidden])').waitFor();
  assert.equal(external.length, requests + 1, '点“重新加载图片”应再请求一次');
});

test('标志图片加载成功：练习模式答题前不显示文字描述，答题后显示', async () => {
  const context = await (await browser()).newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('https://files.ontario.ca/')) return route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
    return /^(file|data|blob):/.test(url) ? route.continue() : route.abort();
  });
  try {
    const { page } = await openApp(browser, { context });
    await page.evaluate(() => { localStorage.setItem('g1-wrong', JSON.stringify({ 'SA-04': 1 })); });
    await page.reload();
    await nav(page, 'wrong');
    await page.click('[data-action="practice-one"]');
    await page.waitForFunction(() => document.querySelector('.signbox img')?.complete);
    assert.equal(await page.locator('.signbox img').isVisible(), true);
    assert.equal(await page.locator('.sign-description').isVisible(), false, '图片正常时答题前不应显示描述（避免提示答案）');
    await answer(page, true);
    assert.equal(await page.locator('.sign-description').isVisible(), true);
  } finally {
    await context.close();
  }
});

test('中文输入法组字时不打断输入，组字结束后再筛选', async () => {
  const { page } = await openApp(browser);
  await nav(page, 'practice');
  const result = await page.evaluate(() => {
    const input = document.getElementById('category-search');
    input.focus();
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    input.value = 'jing';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText', data: 'jing' }));
    const survived = document.getElementById('category-search') === input;
    input.value = '警告';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText', data: '警告' }));
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '警告' }));
    return { survived };
  });
  assert.equal(result.survived, true, '组字过程中输入框被重建');
  assert.equal(await page.locator('.category-card').count(), 1);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'category-search');
});

test('结束练习时有未答题会先确认', async () => {
  const { page } = await openApp(browser);
  await startPractice(page);
  await answer(page, true);
  await page.click('.answer-cell[data-index="9"]');
  await page.click('.quiz-actions [data-action="finish"]');
  await page.locator('.modal-card').waitFor();
  assert.match(await page.locator('#confirm-message').innerText(), /还有 9 道题没有作答/);
  await confirmModal(page, false);
  assert.equal((await page.locator('#page-title').innerText()).trim(), '分类练习');
});
