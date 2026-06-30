import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { request as httpRequest } from 'node:http';

process.env.WRITING_VAULT_DISABLED = '1';
const { createPublisherServer } = await import('./article-publisher.mjs');
const root = mkdtempSync(resolve(tmpdir(), 'xueyusi-publisher-'));
const vault = resolve(root, 'vault');
mkdirSync(vault, { recursive: true });
writeFileSync(resolve(vault, '文章.md'), '# 一篇文章\n\n这里是可以被发布器识别的 Dropbox 原稿正文。\n', 'utf8');
assert.match(readFileSync('open-article-publisher.cmd', 'utf8'), /wscript\.exe \/\/nologo/);
assert.match(readFileSync('scripts/launch-article-publisher.vbs', 'utf8'), /article-publisher\.mjs", 0, False/);
assert.match(readFileSync('发布文章.command', 'utf8'), /nohup node scripts\/article-publisher\.mjs/);

const server = createPublisherServer({ vaultPath: vault, inactivityMs: 30_000 });
try {
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(html, /发布文章/);
  assert.match(html, /同步到博客/);
  assert.match(html, /一篇文章/);
  assert.doesNotMatch(html, /新建文章|预发布|批量导入|打开写作/);
  const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(inlineScript);
  assert.doesNotThrow(() => new Function(inlineScript));
  const blockedStatus = await new Promise((resolveStatus, rejectStatus) => {
    const request = httpRequest({ hostname: '127.0.0.1', port, path: '/', headers: { Host: 'publisher.example' } }, (blocked) => {
      blocked.resume();
      resolveStatus(blocked.statusCode);
    });
    request.on('error', rejectStatus);
    request.end();
  });
  assert.equal(blockedStatus, 403);
  console.log('极简发布器界面测试通过。');
} finally {
  server.close();
  rmSync(root, { recursive: true, force: true });
}
