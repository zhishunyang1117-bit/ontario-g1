// 测试公用工具：用无头 Chromium 以 file:// 打开生成的 05_模拟练习.html。
// 除本地文件外的所有请求都会被拦截（模拟离线；files.ontario.ca 的标志图片因此必然加载失败），
// 所以测试不依赖外网，也顺带验证网页能离线使用。
const { chromium } = require('playwright');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, '05_模拟练习.html');
const APP_URL = pathToFileURL(HTML).href;
const FIXTURES = path.join(__dirname, 'fixtures');
const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

// 中文文件名的下载在没有 UTF-8 区域设置的 Linux 容器里会被浏览器改名为 “download”，这里显式指定。
function launch() {
  return chromium.launch({ env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } });
}

// 每个测试文件共用一个浏览器：第一次用到时才启动（按名称过滤掉全部用例时不会留下没关的浏览器），文件结束时关闭。
function sharedBrowser() {
  let launching = null;
  test.after(async () => { if (launching) await (await launching).close(); });
  return () => (launching ||= launch());
}

async function openApp(browser, { viewport = DESKTOP, colorScheme = 'light', storage = null, context = null, reducedMotion = 'reduce' } = {}) {
  if (typeof browser === 'function') browser = await browser();
  const ctx = context || await browser.newContext({ viewport, colorScheme, acceptDownloads: true, reducedMotion });
  const external = [];
  if (!context) {
    await ctx.route('**/*', route => {
      const url = route.request().url();
      if (/^(file|data|blob):/.test(url)) return route.continue();
      external.push(url);
      return route.abort();
    });
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text());
  });
  await page.goto(APP_URL);
  if (storage) {
    await page.evaluate(values => {
      localStorage.clear();
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }, storage);
    await page.reload();
  }
  return { context: ctx, page, errors, external };
}

const read = (page, key) => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);

// 点击导航：手机宽度下先打开抽屉菜单。
async function nav(page, name) {
  const target = page.locator(`#sidebar [data-page="${name}"]`).first();
  const menu = page.locator('#mobile-menu');
  if (!(await target.isVisible()) || (await menu.isVisible() && !(await page.evaluate(() => document.body.classList.contains('sidebar-open'))))) {
    if (await menu.isVisible()) await menu.click();
  }
  await target.click();
}

async function currentQuestion(page) {
  const id = (await page.locator('.question-id').innerText()).trim();
  const answer = await page.evaluate(qid => BANK.find(q => q.id === qid).answer_index, id);
  return { id, answer };
}

// 选出正确（或错误）的选项；返回题号。
async function answer(page, correct = true) {
  const { id, answer: right } = await currentQuestion(page);
  const option = correct ? right : (right + 1) % 4;
  await page.locator(`.opt[data-option="${option}"]`).click();
  return id;
}

async function startPractice(page, { count = 10 } = {}) {
  await nav(page, 'practice');
  await page.click(`[data-action="practice-count"][data-value="${count}"]`);
  await page.click('[data-action="start-practice"]');
  await page.locator('.question-id').waitFor();
}

async function confirmModal(page, accept = true) {
  await page.locator('.modal-card').waitFor();
  await page.click(accept ? '[data-modal-confirm]' : '[data-modal-cancel]');
  await page.locator('.modal-card').waitFor({ state: 'detached' });
}

async function noHorizontalScroll(page, label) {
  const [scrollWidth, width] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(scrollWidth <= width, `${label}: 页面出现横向滚动（${scrollWidth} > ${width}）`);
}

module.exports = { ROOT, HTML, APP_URL, FIXTURES, DESKTOP, MOBILE, launch, sharedBrowser, openApp, read, nav, currentQuestion, answer, startPractice, confirmModal, noHorizontalScroll };
