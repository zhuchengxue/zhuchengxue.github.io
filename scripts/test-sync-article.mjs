import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('scripts/lib/sync-article.mjs', 'utf8');
assert.match(source, /git', \['pull', '--rebase'\]/);
assert.match(source, /transformDropboxArticle/);
assert.match(source, /const addPaths = \[transformed\.relativeTarget\]/);
assert.match(source, /git', \['add', '-A', '--', \.\.\.addPaths\]/);
assert.doesNotMatch(source, /npm(?:\.cmd)?[^\n]+run[^\n]+build/);
assert.match(source, /scripts\/create-wechat-draft\.mjs/);
assert.match(source, /WECHAT_OUTPUT_DIRECTORY: wechatOutput/);
assert.match(source, /rmSync\(wechatOutput, \{ recursive: true, force: true \}\)/);
console.log('轻量同步流程测试通过：本机不执行 Astro 全站构建。');
