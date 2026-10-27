#!/usr/bin/env node
// 一条命令跑完全部测试：node tests/run.js
// 可以附加 node --test 的参数，例如：node tests/run.js --test-name-pattern=导入
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const files = fs.readdirSync(__dirname).filter(name => name.endsWith('.test.js')).sort().map(name => path.join(__dirname, name));
const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...process.argv.slice(2), ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
