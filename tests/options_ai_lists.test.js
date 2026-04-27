// 简单的“冒烟测试”：确保 options 页面仍包含 AI 垃圾用户/误报列表相关 DOM 结构与渲染函数。
// 运行方式：node tests/options_ai_lists.test.js

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const optionsHtml = fs.readFileSync(path.join(root, 'src/options/options.html'), 'utf8');
const optionsJs = fs.readFileSync(path.join(root, 'src/options/options.js'), 'utf8');

// HTML: 必须存在列表容器与计数器
assert.match(optionsHtml, /id="aiSpamUsersList"/, 'options.html 缺少 aiSpamUsersList');
assert.match(optionsHtml, /id="falsePositiveUsersList"/, 'options.html 缺少 falsePositiveUsersList');
assert.match(optionsHtml, /id="aiSpamUserCount"/, 'options.html 缺少 aiSpamUserCount');
assert.match(optionsHtml, /id="falsePositiveUserCount"/, 'options.html 缺少 falsePositiveUserCount');

// JS: 必须存在渲染入口与计数更新
assert.match(optionsJs, /function\s+renderAISpamUsers\s*\(/, 'options.js 缺少 renderAISpamUsers()');
assert.match(optionsJs, /function\s+renderFalsePositiveUsers\s*\(/, 'options.js 缺少 renderFalsePositiveUsers()');
assert.match(optionsJs, /aiSpamUserCount/, 'options.js 未更新 aiSpamUserCount');
assert.match(optionsJs, /falsePositiveUserCount/, 'options.js 未更新 falsePositiveUserCount');

console.log('OK: options AI lists smoke test passed');

