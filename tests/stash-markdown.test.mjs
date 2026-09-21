import test from 'node:test';
import assert from 'node:assert/strict';
import { highlightMarkdown } from '../src/lib/stash/markdown.js';
const roles = text => highlightMarkdown(text).map(span => ({ ...span, value: text.slice(span.from, span.to) }));
const has = (text, role, value) => roles(text).some(s => s.role === role && s.value === value);
test('Seal Note headings, emphasis and UTF-16 offsets', () => {
  const text = '😀 中文\n# 标题\n## 第二级\n###### 第六级\n**粗体** __粗体二__ *斜体* _斜体二_ ~~删除~~ <u>下划线</u>';
  for (const [role, value] of [['headingText','标题'],['headingText','第二级'],['headingText','第六级'],['strongText','粗体'],['strongText','粗体二'],['italicText','斜体'],['italicText','斜体二'],['strikeText','删除'],['underlineText','下划线']]) assert.ok(has(text, role, value), role + value);
  assert.ok(has(text,'headingMarker','# '));
  assert.equal(highlightMarkdown('==普通文本==').length,0);
});
test('fences highlight only markers, not their body; inline triple backticks stay plain', () => {
  const text = '```markdown\n# 普通代码 **不是粗体**\n```\n\n~~~\n<!-- 普通代码 -->\n~~~';
  assert.equal(roles(text).filter(s => s.role === 'codeFenceMarker').length,4);
  assert.equal(roles(text).filter(s => s.role !== 'codeFenceMarker').length,0);
  assert.ok(has('use `foo` here','inlineCode','`foo`'));
  assert.equal(highlightMarkdown('before ```内容``` after').length,0);
});
test('links, image syntax, list markers, tasks and quotes', () => {
  const text = '[链接](https://example.com) ![图片](a.png)\n- [ ] 待办\n- [X] 完成\n1. 条目\n2) 条目\n+ 条目\n> 引用';
  for (const [role,value] of [['linkText','链接'],['linkURL','https://example.com'],['imageMarker','!['],['linkText','图片'],['taskMarker','[ ]'],['taskMarker','[X]'],['listMarker','1.'],['listMarker','2)'],['listMarker','+'],['quoteMarker','>']]) assert.ok(has(text,role,value), role+value);
});
test('whole-line comments only; comments and code exclude inner formatting', () => {
  assert.ok(has('  <!-- **注释** -->  ','htmlComment','<!-- **注释** -->'));
  assert.equal(roles('先做 <!--TODO--> 再说').some(s => s.role==='htmlComment'),false);
  assert.equal(roles('<!-- **注释** -->').some(s => s.role==='strongText'),false);
  assert.equal(roles('`**源码**`').some(s => s.role==='strongText'),false);
});
test('tables and horizontal rules; pipes outside tables remain plain', () => {
  assert.equal(roles('| a | b |\n| --- | :---: |\n| 1 | 2 |').filter(s=>s.role==='tableDelimiter').length,9);
  assert.equal(roles('a | b').length,0);
  for (const text of ['---','***','___','- - -']) assert.ok(has(text,'horizontalRule',text));
});
test('HTML remains source text and large multiline paste keeps valid ranges', () => {
  const text = '<img src=x onerror=alert(1)>\n' + '## 😀 中文 **粗体**\n'.repeat(1800);
  const spans = roles(text);
  assert.equal(spans.filter(s=>s.role==='headingText').length,1800);
  assert.ok(spans.every(s=>s.from>=0 && s.to<=text.length && s.to>s.from));
  assert.equal(highlightMarkdown('<script>alert(1)</script>').length,0);
});

// Display boundaries affect what the user can identify before downloading.
import { formatSize, filenameParts } from '../src/lib/stash/file-display.js';
test('file display uses integer KB, rounded unit promotion and preserves filename suffix', () => {
  assert.equal(formatSize(1023), '1023 B');
  assert.equal(formatSize(1536), '2 KB');
  assert.equal(formatSize(1024 * 1024 - 1), '1.0 MB');
  assert.equal(formatSize(10 * 1024 * 1024), '10.0 MB');
  for (const name of ['报告最终版.xlsx', '资料😀.zip', '.gitignore', '无扩展名资料']) assert.equal(filenameParts(name).join(''), name);
  assert.equal(filenameParts('报告最终版.xlsx')[1], '版.xlsx');
});

import { countdown } from '../src/lib/stash/countdown.js';
test('countdown handles empty, seven days, seconds and expiry', () => {
  assert.equal(countdown(null, 0), '');
  assert.equal(countdown(7 * 86400000, 0), '7 天 0 小时 0 分钟后清空');
  assert.equal(countdown(61000, 0), '1 分钟后清空');
  assert.equal(countdown(1000, 0), '1 秒后清空');
  assert.equal(countdown(1000, 1000), '即将清空');
});

import { imageMime } from '../src/lib/stash/file-display.js';
test('image preview recognizes common image extensions case-insensitively', () => {
  assert.equal(imageMime('照片.PNG'), 'image/png');
  assert.equal(imageMime('drawing.svg'), 'image/svg+xml');
  assert.equal(imageMime('photo.jpg.zip'), null);
  assert.equal(imageMime(), null);
});
