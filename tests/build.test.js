// 生成文件与单文件离线约束。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { ROOT, HTML, launch, openApp, startPractice, nav, answer } = require('./helpers');

function python(args) {
  for (const exe of [process.env.PYTHON, 'python3', 'python'].filter(Boolean)) {
    const result = spawnSync(exe, args, { cwd: ROOT, encoding: 'utf8' });
    if (!result.error) return result;
  }
  throw new Error('找不到 Python 3，无法检查生成文件');
}

test('05_模拟练习.html 已按源文件重新生成', () => {
  const result = python(['tools/build.py', '--check']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('网页是自包含的单文件：不引用外部脚本、样式表或字体', () => {
  const html = fs.readFileSync(HTML, 'utf8');
  assert.doesNotMatch(html, /<script[^>]+\bsrc=/i);
  assert.doesNotMatch(html, /<link[^>]+rel=["']?stylesheet/i);
  assert.doesNotMatch(html, /@import\s|@font-face|fonts\.googleapis|fonts\.gstatic|cdnjs|jsdelivr|unpkg/i);
  assert.match(html.slice(0, 300), /<meta charset="utf-8">/i, 'charset 声明应在文件开头');
});

test('内嵌的必背速查只含链接和粗体两种标签，外链都在新窗口打开', () => {
  const html = fs.readFileSync(HTML, 'utf8');
  const ref = JSON.parse(html.match(/^const REF = (.*);\r?$/m)[1]);
  // html、表头和表格单元格会原样插进页面，其余字段（标题等）渲染时再转义
  const fragments = [];
  const walk = (value, key) => {
    if (typeof value === 'string') {
      if (key === 'html' || key === 'cell') fragments.push(value);
    } else if (Array.isArray(value)) {
      value.forEach(v => walk(v, key === 'head' || key === 'rows' || key === 'cell' ? 'cell' : key));
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, k);
    }
  };
  walk(ref);
  assert.deepEqual(ref.docs.map(d => d.id), ['cheat', 'info']);
  assert.ok(fragments.length > 200, `速查内容太少：${fragments.length} 段`);
  const allowed = /<a href="https?:\/\/[^"<>\s]+" target="_blank" rel="noopener noreferrer">|<\/a>|<\/?strong>/g;
  let links = 0;
  for (const fragment of fragments) {
    links += (fragment.match(/<a /g) || []).length;
    const rest = fragment.replace(allowed, '');
    assert.doesNotMatch(rest, /[<>]/, `出现了不允许的标签：${fragment}`);
  }
  assert.ok(links > 10, `外部链接应保留：${links}`);
});

test('在线版入口 index.html 跳到练习页面', async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => /^(file|data|blob):/.test(route.request().url()) ? route.continue() : route.abort());
    await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href);
    await page.waitForURL(/05_%E6%A8%A1%E6%8B%9F%E7%BB%83%E4%B9%A0\.html$/);
    await page.waitForFunction(() => typeof BANK !== 'undefined' && BANK.length === 723);
    assert.ok(fs.existsSync(path.join(ROOT, '.nojekyll')), 'GitHub Pages 应原样发布文件（不经过 Jekyll）');
  } finally {
    await browser.close();
  }
});

test('离线打开：除官方标志图片外不发出任何外部请求，也没有脚本错误', async () => {
  const browser = await launch();
  try {
    const { page, errors, external } = await openApp(browser);
    assert.equal(await page.evaluate(() => BANK.length), 723);
    await startPractice(page, { count: 10 });
    for (let i = 0; i < 3; i++) {
      await answer(page, true);
      await page.click('[data-action="next"]');
    }
    for (const name of ['exam', 'wrong', 'bookmarks', 'stats', 'settings', 'home']) await nav(page, name);
    assert.deepEqual(errors, []);
    assert.ok(external.every(url => url.startsWith('https://files.ontario.ca/')), `意外的外部请求：${external.join(', ')}`);
  } finally {
    await browser.close();
  }
});
