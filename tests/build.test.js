// 生成文件与单文件离线约束。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
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
