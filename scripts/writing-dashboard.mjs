import { createServer } from 'node:http';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import matter from 'gray-matter';
import { readLocalEnv, updateLocalEnv } from './lib/local-env.mjs';
import { findObsidianVault, obsidianFileURL } from './lib/obsidian-vault.mjs';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const postsDirectory = resolve(workspace, 'src/content/posts');
const importsDirectory = resolve(workspace, 'imports/wechat');
const writingVault = findObsidianVault();
const writingDirectory = writingVault ? resolve(writingVault, '博客网站') : null;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_OUTPUT_CHARS = 120_000;

function parsePost(file) {
  const path = resolve(postsDirectory, file);
  const mirror = writingDirectory ? resolve(writingDirectory, file) : null;
  const sourcePath = mirror && existsSync(mirror) && statSync(mirror).mtimeMs > statSync(path).mtimeMs ? mirror : path;
  const source = readFileSync(sourcePath, 'utf8');
  const data = matter(source).data;
  const pubDate = data.pubDate instanceof Date ? data.pubDate.toISOString().slice(0, 10) : String(data.pubDate || '');
  return {
    path: relative(workspace, path).replaceAll('\\', '/'),
    title: String(data.title || basename(file, '.md')),
    pubDate,
    draft: data.draft === true
  };
}

function writingPath(post) {
  return writingDirectory ? resolve(writingDirectory, basename(post.path)) : null;
}

function requireWritingVault() {
  if (!writingVault || !writingDirectory) throw new Error('没有找到 Obsidian Vault。请先在 Obsidian 中打开你的 Dropbox 写作文件夹。');
  mkdirSync(writingDirectory, { recursive: true });
}

function syncToWritingVault(post, force = false) {
  requireWritingVault();
  const source = resolve(workspace, post.path);
  const target = writingPath(post);
  if (force || !existsSync(target) || statSync(source).mtimeMs >= statSync(target).mtimeMs) copyFileSync(source, target);
  return target;
}

function syncFromWritingVault(post) {
  const source = writingPath(post);
  const target = resolve(workspace, post.path);
  if (source && existsSync(source) && statSync(source).mtimeMs > statSync(target).mtimeMs) copyFileSync(source, target);
}

function listPosts() {
  if (!existsSync(postsDirectory)) return [];
  return readdirSync(postsDirectory)
    .filter((file) => file.endsWith('.md'))
    .map(parsePost)
    .sort((a, b) => b.pubDate.localeCompare(a.pubDate) || a.title.localeCompare(b.title, 'zh-CN'));
}

function countFiles(directory, ignored = new Set(['.gitkeep'])) {
  if (!existsSync(directory)) return 0;
  return readdirSync(directory, { withFileTypes: true }).reduce((count, entry) => {
    if (ignored.has(entry.name)) return count;
    const path = resolve(directory, entry.name);
    return count + (entry.isDirectory() ? countFiles(path, ignored) : 1);
  }, 0);
}

function getState(activeOperation) {
  const posts = listPosts();
  const localEnv = { ...readLocalEnv(), ...process.env };
  return {
    posts,
    drafts: posts.filter((post) => post.draft).length,
    publishedMarkdown: posts.filter((post) => !post.draft).length,
    legacy: 70,
    importFiles: countFiles(importsDirectory),
    inboxImages: countFiles(resolve(workspace, 'public/images/inbox')),
    dependenciesReady: existsSync(resolve(workspace, 'node_modules/astro/package.json')),
    wechatConfigured: Boolean(localEnv.WECHAT_APP_ID && localEnv.WECHAT_APP_SECRET),
    writingVault: writingVault ? basename(writingVault) : '',
    activeOperation
  };
}

function executable(command) {
  return process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
}

function runProcess(command, args, timeoutMs = 30 * 60 * 1000) {
  return new Promise((resolveRun) => {
    const child = spawn(executable(command), args, {
      cwd: workspace,
      shell: false,
      windowsHide: true,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }
    });
    let output = '';
    const append = (chunk) => {
      output += chunk.toString();
      if (output.length > MAX_OUTPUT_CHARS) output = `…输出过长，已截断前半部分…\n${output.slice(-MAX_OUTPUT_CHARS)}`;
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolveRun({ ok: false, code: null, output: `${output}\n${error.message}`.trim() });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveRun({ ok: code === 0, code, output: output.trim() || (code === 0 ? '操作完成。' : `操作失败，退出码 ${code}`) });
    });
  });
}

function openExternal(target) {
  const options = { detached: true, stdio: 'ignore', windowsHide: true };
  const child = process.platform === 'win32'
    ? spawn('rundll32.exe', ['url.dll,FileProtocolHandler', target], options)
    : process.platform === 'darwin'
      ? spawn('open', [target], options)
      : spawn('xdg-open', [target], options);
  child.unref();
}

function dashboardHTML(token, nonce) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>学语思 · 写作控制台</title>
  <style>
    :root{color-scheme:light dark;--bg:#f5f7f4;--card:#fff;--text:#17251e;--muted:#6c776f;--green:#276749;--line:#dbe4dd;--soft:#eef4f0;--warn:#a64a3d}
    @media(prefers-color-scheme:dark){:root{--bg:#101713;--card:#18221c;--text:#eef6f0;--muted:#a4b2a9;--green:#75c794;--line:#304137;--soft:#213128;--warn:#df8073}}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}.shell{width:min(760px,calc(100% - 28px));margin:auto;padding:54px 0 70px}header{text-align:center;margin-bottom:28px}h1{margin:0;font-size:clamp(32px,7vw,48px);letter-spacing:-.05em}h1 span{color:var(--green)}.subtitle{margin:5px 0 14px;color:var(--muted)}.status{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.pill{padding:4px 10px;border-radius:999px;color:var(--muted);background:var(--soft);font-size:13px}.card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:24px;margin-bottom:14px}h2{margin:0 0 14px;font-size:18px}label{display:block;margin:13px 0 6px;color:var(--muted);font-size:13px}input,select{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--bg);color:var(--text);font:inherit}.new-row{display:grid;grid-template-columns:1fr auto;gap:10px}.new-row button{white-space:nowrap}.actions{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:10px;margin-top:16px}button,.link-button{border:0;border-radius:11px;padding:12px 16px;background:var(--green);color:white;font:inherit;font-weight:650;cursor:pointer;text-decoration:none;text-align:center}.secondary{background:var(--soft);color:var(--green)}.danger{background:var(--warn)}button:disabled{opacity:.55;cursor:wait}.hint{color:var(--muted);font-size:13px;margin:11px 0 0}.divider{height:1px;background:var(--line);margin:22px 0}details{background:var(--card);border:1px solid var(--line);border-radius:16px;margin-top:14px}summary{padding:15px 18px;cursor:pointer;color:var(--muted);font-weight:600}details[open] summary{border-bottom:1px solid var(--line)}.tools{padding:6px 18px 18px}.tool-section{padding:12px 0}.tool-section+.tool-section{border-top:1px solid var(--line)}.tool-section h3{margin:0 0 8px;font-size:14px}.row{display:flex;gap:8px;flex-wrap:wrap}.row button,.row .link-button{padding:8px 11px;font-size:13px}.result{margin-top:14px;padding:14px 16px;border-radius:14px;background:var(--soft)}pre{max-height:240px;overflow:auto;white-space:pre-wrap;word-break:break-word;margin:0;color:var(--text);font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace}.result-actions{display:flex;gap:8px;margin-top:10px}.result-actions button{padding:6px 9px;font-size:12px}@media(max-width:620px){.shell{padding-top:30px}.new-row,.actions{grid-template-columns:1fr}.card{padding:19px}}
  </style>
</head>
<body><main class="shell">
  <header><h1><span>学语思</span></h1><p class="subtitle">写一次，发布到博客和公众号。</p><div id="status" class="status"></div></header>
  <section class="card">
    <form id="new-form"><label for="title">新文章</label><div class="new-row"><input id="title" required maxlength="100" placeholder="输入标题"><button type="submit">开始写作</button></div></form>
    <div class="divider"></div>
    <label for="article">我的文章</label><select id="article"></select>
    <div class="actions"><button data-action="open-article">打开写作</button><button class="secondary" data-action="publish">发布博客</button><button class="secondary" data-action="wechat-push">推送公众号</button></div>
    <p class="hint">文章保存在 Dropbox；公众号只推送到草稿箱，不会自动群发。</p>
  </section>
  <div class="result"><pre id="output">正在准备…</pre></div>
  <details><summary>设置与工具</summary><div class="tools">
    <div class="tool-section"><h3>文章工具</h3><div class="row"><button class="secondary" data-action="check">检查</button><button class="secondary" data-action="preview">预发布</button><button class="secondary" data-action="wechat">导出公众号 HTML</button></div></div>
    <div class="tool-section"><h3>公众号连接</h3><form id="wechat-form"><input id="wechat-app-id" autocomplete="off" placeholder="AppID"><label for="wechat-app-secret">AppSecret</label><input id="wechat-app-secret" type="password" autocomplete="new-password" placeholder="只保存在本机"><div class="row"><button type="submit">保存连接</button></div></form><p id="wechat-status" class="hint">正在检查配置…</p></div>
    <div class="tool-section"><h3>Dropbox 旧文章</h3><div class="row"><button class="secondary" data-action="dropbox-import-preview">扫描</button><button class="secondary" data-action="dropbox-import">全部导入为草稿</button><button class="danger" data-action="dropbox-publish">发布“已发布”目录</button></div><p class="hint">根目录文章只导入为草稿；批量发布会排除《写作风格》。</p></div>
    <div class="tool-section"><h3>系统</h3><div class="row"><button class="secondary" data-action="doctor">体检</button><button class="secondary" data-action="handoff">换电脑盘点</button><button class="secondary" data-action="install">修复依赖</button><button class="secondary" data-action="refresh">刷新</button><button class="secondary" data-action="shutdown">关闭</button><a class="link-button secondary" href="https://zhuchengxue.github.io/" target="_blank" rel="noreferrer">查看博客</a></div></div>
  </div></details>
</main>
<script nonce="${nonce}">
const token=${JSON.stringify(token)};let state=null;let busy=false;let firstLoad=true;const output=document.querySelector('#output');const articleSelect=document.querySelector('#article');
async function request(path,options={}){const headers={...(options.headers||{}),'x-writing-token':token};const response=await fetch(path,{...options,headers});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'操作失败'),{data});return data}
function setBusy(value){busy=value;document.querySelectorAll('button').forEach(button=>button.disabled=value)}
function render(next){state=next;const status=document.querySelector('#status');status.textContent='';[['Dropbox',next.writingVault?'已连接':'未连接'],['公众号',next.wechatConfigured?'已连接':'未连接'],['文章',next.legacy+next.publishedMarkdown+next.drafts]].forEach(([label,value])=>{const span=document.createElement('span');span.className='pill';span.textContent=label+' · '+value;status.append(span)});document.querySelector('#wechat-status').textContent=next.wechatConfigured?'公众号已连接。':'每台电脑首次填写一次。';const selected=articleSelect.value;articleSelect.textContent='';for(const post of next.posts){const option=document.createElement('option');option.value=post.path;option.textContent=(post.draft?'草稿 · ':'')+post.title;articleSelect.append(option)}if(next.posts.some(post=>post.path===selected))articleSelect.value=selected;if(!next.dependenciesReady)output.textContent='首次使用，请展开“设置与工具”并点击“修复依赖”。'}
async function refresh(){try{render(await request('/api/state'));if(firstLoad){output.textContent='准备就绪。请选择文章或新建文章开始写作。';firstLoad=false}}catch(error){output.textContent=error.message}}
async function action(name,payload={}){if(busy)return;setBusy(true);output.textContent='正在执行，请稍候…';try{const result=await request('/api/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:name,...payload})});output.textContent=result.output||'操作完成。';await refresh();if(result.obsidianUrl)location.href=result.obsidianUrl;if(name==='shutdown')output.textContent='控制台已关闭，可以关闭这个页面。'}catch(error){output.textContent=(error.data?.output?error.data.output+String.fromCharCode(10,10):'')+error.message}finally{setBusy(false)}}
document.querySelector('#new-form').addEventListener('submit',event=>{event.preventDefault();action('new',{title:document.querySelector('#title').value})});
document.querySelector('#wechat-form').addEventListener('submit',event=>{event.preventDefault();const appId=document.querySelector('#wechat-app-id').value.trim();const appSecret=document.querySelector('#wechat-app-secret').value.trim();if(!appId||!appSecret){output.textContent='请同时填写 AppID 和 AppSecret。';return}action('wechat-config',{appId,appSecret});document.querySelector('#wechat-app-secret').value=''});
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{const name=button.dataset.action;if(name==='refresh')return refresh();const article=articleSelect.value;if(['open-article','check','preview','wechat'].includes(name))return action(name,{article});if(name==='wechat-push'){if(confirm('确定把这篇文章上传到公众号草稿箱吗？不会自动群发。'))return action(name,{article,confirmation:article});return}if(name==='publish'){if(confirm('确定正式发布这篇文章吗？这会提交并推送到博客。'))return action(name,{article,confirmation:article});return}if(name==='dropbox-import'){if(confirm('确定把 Dropbox 写作库中的文章全部导入为本地草稿吗？不会上线。'))return action(name,{confirmation:'dropbox-import'});return}if(name==='dropbox-publish'){if(confirm('确定批量发布 Dropbox“已发布”目录中的文章吗？会构建、提交并推送博客。'))return action(name,{confirmation:'dropbox-publish'});return}if(name==='install'){if(confirm('确定安装或修复项目依赖吗？需要访问 npm 软件源。'))return action(name,{confirmation:'install'});return}action(name)}));refresh();
</script></body></html>`;
}

function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) request.destroy();
    });
    request.on('end', () => {
      try { resolveBody(JSON.parse(body || '{}')); } catch { rejectBody(new Error('请求格式无效。')); }
    });
    request.on('error', rejectBody);
  });
}

function sendJSON(response, status, data) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(data));
}

export async function createDashboardServer({ port = 4179, openBrowser = true, quiet = false } = {}) {
  const token = randomBytes(24).toString('base64url');
  const nonce = randomBytes(18).toString('base64');
  let activeOperation = null;
  let server;

  const handler = async (request, response) => {
    const host = request.headers.host || '';
    if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host)) return sendJSON(response, 403, { error: '只允许本机访问。' });
    const url = new URL(request.url || '/', `http://${host}`);
    response.setHeader('x-frame-options', 'DENY');
    response.setHeader('x-content-type-options', 'nosniff');

    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-security-policy': `default-src 'self'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'`
      });
      return response.end(dashboardHTML(token, nonce));
    }

    if (request.headers['x-writing-token'] !== token) return sendJSON(response, 403, { error: '本机会话验证失败，请刷新控制台。' });
    if (request.method === 'GET' && url.pathname === '/api/state') return sendJSON(response, 200, getState(activeOperation));
    if (request.method !== 'POST' || url.pathname !== '/api/action') return sendJSON(response, 404, { error: '页面不存在。' });

    const origin = request.headers.origin;
    if (origin && !new Set([`http://${host}`, `http://127.0.0.1:${server.address().port}`, `http://localhost:${server.address().port}`]).has(origin)) {
      return sendJSON(response, 403, { error: '拒绝非本机页面触发操作。' });
    }
    if (activeOperation) return sendJSON(response, 409, { error: `正在执行：${activeOperation}` });

    let payload;
    try { payload = await readBody(request); } catch (error) { return sendJSON(response, 400, { error: error.message }); }
    const action = String(payload.action || '');
    const posts = listPosts();
    const selected = posts.find((post) => post.path === payload.article);
    const articleActions = new Set(['open-article', 'check', 'preview', 'publish', 'wechat', 'wechat-push']);
    if (articleActions.has(action) && !selected) return sendJSON(response, 400, { error: '请选择有效文章。' });
    if (action === 'publish' && payload.confirmation !== selected.path) return sendJSON(response, 400, { error: '正式发布确认失败。' });
    if (action === 'wechat-push' && payload.confirmation !== selected.path) return sendJSON(response, 400, { error: '公众号草稿推送确认失败。' });
    if (action === 'dropbox-import' && payload.confirmation !== 'dropbox-import') return sendJSON(response, 400, { error: 'Dropbox 批量导入确认失败。' });
    if (action === 'dropbox-publish' && payload.confirmation !== 'dropbox-publish') return sendJSON(response, 400, { error: 'Dropbox 批量发布确认失败。' });
    if (action === 'import' && payload.confirmation !== 'import') return sendJSON(response, 400, { error: '批量导入确认失败。' });
    if (action === 'install' && payload.confirmation !== 'install') return sendJSON(response, 400, { error: '依赖安装确认失败。' });

    let command;
    if (action === 'new') {
      const title = String(payload.title || '').trim();
      const slug = String(payload.slug || '').trim();
      if (!title || title.length > 100 || slug.length > 80) return sendJSON(response, 400, { error: '请填写有效标题，短名不能超过 80 个字符。' });
      command = ['node', ['scripts/new-post.mjs', title, ...(slug ? [slug] : [])]];
    } else if (action === 'open-article') {
      const target = syncToWritingVault(selected);
      openExternal(obsidianFileURL(writingVault, target));
      return sendJSON(response, 200, { ok: true, output: `已在 Dropbox 写作库中打开：${target}` });
    } else if (action === 'check') command = ['node', ['scripts/check-post-ready.mjs', selected.path]];
    else if (action === 'preview') command = ['node', ['scripts/publish-post.mjs', selected.path, '--dry-run']];
    else if (action === 'publish') command = ['node', ['scripts/publish-post.mjs', selected.path]];
    else if (action === 'wechat') command = ['node', ['scripts/generate-wechat.mjs', selected.path]];
    else if (action === 'wechat-push') command = ['node', ['scripts/push-wechat.mjs', selected.path]];
    else if (action === 'dropbox-import-preview') command = ['node', ['scripts/import-dropbox-posts.mjs', '--dry-run']];
    else if (action === 'dropbox-import') command = ['node', ['scripts/import-dropbox-posts.mjs']];
    else if (action === 'dropbox-publish') command = ['node', ['scripts/publish-dropbox-archive.mjs']];
    else if (action === 'wechat-config') {
      const appId = String(payload.appId || '').trim();
      const appSecret = String(payload.appSecret || '').trim();
      if (!/^[A-Za-z0-9_-]{6,64}$/.test(appId) || appSecret.length < 8 || appSecret.length > 128) {
        return sendJSON(response, 400, { error: 'AppID 或 AppSecret 格式不正确。' });
      }
      updateLocalEnv({ WECHAT_APP_ID: appId, WECHAT_APP_SECRET: appSecret });
      return sendJSON(response, 200, { ok: true, output: '公众号连接信息已安全保存到本机 .env，不会提交到 GitHub。' });
    }
    else if (action === 'import-preview') command = ['node', ['scripts/import-wechat.mjs', '--dry-run', '--report']];
    else if (action === 'import') command = ['node', ['scripts/import-wechat.mjs']];
    else if (action === 'doctor') command = ['node', ['scripts/doctor.mjs', '--allow-dirty']];
    else if (action === 'handoff') command = ['node', ['scripts/handoff.mjs']];
    else if (action === 'install') command = ['npm', ['ci']];
    else if (action === 'open-imports') {
      openExternal(importsDirectory);
      return sendJSON(response, 200, { ok: true, output: `已打开导入目录：${importsDirectory}` });
    } else if (action === 'shutdown') {
      sendJSON(response, 200, { ok: true, output: '控制台已关闭。' });
      return setTimeout(() => server.close(), 100);
    } else return sendJSON(response, 400, { error: '未知操作。' });

    if (selected && !new Set(['open-article']).has(action)) syncFromWritingVault(selected);
    activeOperation = action;
    const result = await runProcess(command[0], command[1]);
    activeOperation = null;
    let obsidianUrl;
    if (action === 'new' && result.ok) {
      const createdPath = result.output.match(/^已创建：(.+)$/m)?.[1]?.trim();
      const createdRelative = createdPath ? relative(workspace, resolve(createdPath)).replaceAll('\\', '/') : '';
      const created = listPosts().find((post) => post.path === createdRelative);
      if (created && writingVault) {
        const target = syncToWritingVault(created, true);
        obsidianUrl = obsidianFileURL(writingVault, target);
      }
    }
    if (writingVault && selected && result.ok && new Set(['check', 'preview', 'publish', 'wechat', 'wechat-push']).has(action)) syncToWritingVault(selected, true);
    return sendJSON(response, result.ok ? 200 : 400, { ...result, obsidianUrl });
  };

  server = createServer((request, response) => handler(request, response).catch((error) => sendJSON(response, 500, { error: error.message })));
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, '127.0.0.1', resolveListen);
  });
  const actualPort = server.address().port;
  const url = `http://127.0.0.1:${actualPort}/`;
  if (!quiet) console.log(`写作控制台已启动：${url}`);
  if (openBrowser) openExternal(url);
  return { server, url, token, close: () => new Promise((resolveClose) => server.close(resolveClose)) };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const portArgument = process.argv.find((argument) => argument.startsWith('--port='));
  const port = portArgument ? Number(portArgument.split('=')[1]) : 4179;
  createDashboardServer({ port, openBrowser: !process.argv.includes('--no-open') }).catch((error) => {
    if (error.code === 'EADDRINUSE') {
      openExternal(`http://127.0.0.1:${port}/`);
      process.exit(0);
    }
    console.error(error);
    process.exit(1);
  });
}
