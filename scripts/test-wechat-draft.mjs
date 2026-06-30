import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const outputDirectory = mkdtempSync(resolve(tmpdir(), 'xueyusi-wechat-test-'));
const metadataPath = resolve(outputDirectory, '__wechat-api-test.json');
const receiptPath = resolve(outputDirectory, '__wechat-api-test.result.json');
writeFileSync(metadataPath, `${JSON.stringify({
  title: '公众号接口测试',
  author: 'test',
  digest: '验证图片、封面和草稿流程',
  content: '<p>正文</p><img src="https://example.invalid/body.png">',
  content_source_url: 'https://example.invalid/post/',
  thumb_media_id: '',
  cover: { localPath: 'public/og-default.png', publicUrl: 'https://example.invalid/cover.png' },
  images: [{ localPath: 'public/og-default.png', publicUrl: 'https://example.invalid/body.png' }]
}, null, 2)}\n`, 'utf8');

let draftPayload;
const calls = [];
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  calls.push(url.pathname);
  const send = (data) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(data));
  };
  if (url.pathname === '/cgi-bin/token') return send({ access_token: 'test-token', expires_in: 7200 });
  if (url.pathname === '/cgi-bin/media/uploadimg') return send({ url: 'https://mmbiz.qpic.cn/body.png' });
  if (url.pathname === '/cgi-bin/material/add_material') return send({ media_id: 'cover-media-id', url: 'https://mmbiz.qpic.cn/cover.png' });
  if (url.pathname === '/cgi-bin/draft/add') {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      draftPayload = JSON.parse(body);
      send({ media_id: 'draft-media-id' });
    });
    return;
  }
  response.writeHead(404).end();
});

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const port = server.address().port;

try {
  const result = await new Promise((resolveRun) => {
    const child = spawn(process.execPath, ['scripts/create-wechat-draft.mjs', metadataPath], {
      cwd: resolve('.'),
      env: {
        ...process.env,
        WECHAT_APP_ID: 'test-app-id',
        WECHAT_APP_SECRET: 'test-app-secret',
        WECHAT_THUMB_MEDIA_ID: '',
        NODE_ENV: 'test',
        WECHAT_OUTPUT_DIRECTORY: outputDirectory,
        WECHAT_API_ORIGIN: `http://127.0.0.1:${port}`
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('close', (code) => resolveRun({ code, output }));
  });

  assert.equal(result.code, 0, result.output);
  assert.deepEqual(calls, ['/cgi-bin/token', '/cgi-bin/media/uploadimg', '/cgi-bin/material/add_material', '/cgi-bin/draft/add']);
  assert.equal(draftPayload.articles[0].thumb_media_id, 'cover-media-id');
  assert.match(draftPayload.articles[0].content, /https:\/\/mmbiz\.qpic\.cn\/body\.png/);
  assert.doesNotMatch(draftPayload.articles[0].content, /example\.invalid\/body/);
  assert.equal(existsSync(receiptPath), true);
  console.log('微信公众号草稿测试通过：正文图片、封面和草稿均已走完整接口链路。');
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
  rmSync(outputDirectory, { recursive: true, force: true });
}
