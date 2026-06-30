import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { readFileSync } from 'node:fs';

process.env.WRITING_VAULT_DISABLED = '1';
const { createDashboardServer } = await import('./writing-dashboard.mjs');

const windowsLauncher = readFileSync('open-writing-dashboard.cmd', 'utf8');
const hiddenLauncher = readFileSync('scripts/launch-writing-dashboard.vbs', 'utf8');
assert.match(windowsLauncher, /wscript\.exe \/\/nologo/);
assert.match(hiddenLauncher, /shell\.Run "node\.exe scripts\\writing-dashboard\.mjs", 0, False/);

const dashboard = await createDashboardServer({ port: 0, openBrowser: false, quiet: true });
try {
  const page = await fetch(dashboard.url);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  const html = await page.text();
  assert.match(html, /写一次，发布到博客和公众号/);
  assert.match(html, /打开 Obsidian 写作/);
  assert.match(readFileSync('scripts/writing-dashboard.mjs', 'utf8'), /obsidianUrl: editorURL/);
  assert.match(html, /<details><summary>设置与工具<\/summary>/);
  assert.doesNotMatch(html, /<h2>积压文章<\/h2>/);
  const clientScript = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(clientScript);
  assert.doesNotThrow(() => new Script(clientScript));

  const forbidden = await fetch(`${dashboard.url}api/state`);
  assert.equal(forbidden.status, 403);

  const stateResponse = await fetch(`${dashboard.url}api/state`, {
    headers: { 'x-writing-token': dashboard.token }
  });
  assert.equal(stateResponse.status, 200);
  const state = await stateResponse.json();
  assert.equal(state.legacy, 70);
  assert.ok(Array.isArray(state.posts));
  const welcome = state.posts.find((post) => post.title === '博客开始营业');
  assert.ok(welcome);

  const origin = new URL(dashboard.url).origin;
  const checkResponse = await fetch(`${dashboard.url}api/action`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': origin,
      'x-writing-token': dashboard.token
    },
    body: JSON.stringify({ action: 'check', article: welcome.path })
  });
  assert.equal(checkResponse.status, 200);
  assert.match((await checkResponse.json()).output, /发布前体检通过/);

  const unconfirmedPublish = await fetch(`${dashboard.url}api/action`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': origin,
      'x-writing-token': dashboard.token
    },
    body: JSON.stringify({ action: 'publish', article: welcome.path })
  });
  assert.equal(unconfirmedPublish.status, 400);

  const rejectedOrigin = await fetch(`${dashboard.url}api/action`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'https://example.com',
      'x-writing-token': dashboard.token
    },
    body: JSON.stringify({ action: 'handoff' })
  });
  assert.equal(rejectedOrigin.status, 403);
} finally {
  await dashboard.close();
}

console.log('本地写作控制台测试通过：页面、本机会话验证和文章状态接口均正常。');
