import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readLocalEnv, updateLocalEnv } from './lib/local-env.mjs';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const postsDirectory = resolve(workspace, 'src/content/posts');
const importsDirectory = resolve(workspace, 'imports/wechat');
const MAX_BODY_BYTES = 64 * 1024;
const MAX_OUTPUT_CHARS = 120_000;

function parsePost(file) {
  const path = resolve(postsDirectory, file);
  const source = readFileSync(path, 'utf8');
  const field = (name) => source.match(new RegExp(`^${name}:\\s*(.*?)\\s*$`, 'm'))?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
  const absolute = path.replaceAll('\\', '/');
  return {
    path: relative(workspace, path).replaceAll('\\', '/'),
    title: field('title') || basename(file, '.md'),
    pubDate: field('pubDate'),
    draft: field('draft') === 'true',
    obsidianUrl: `obsidian://open?path=${encodeURIComponent(absolute)}`
  };
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
    :root{color-scheme:light dark;--bg:#f4f6f2;--card:#fffdf8;--text:#17251e;--muted:#647169;--green:#276749;--button:#276749;--line:#dce5de;--warn:#9a5b13;--shadow:0 16px 40px rgba(29,61,45,.09)}
    @media(prefers-color-scheme:dark){:root{--bg:#101713;--card:#18221c;--text:#eef6f0;--muted:#a4b2a9;--green:#7fc39a;--button:#2d7a4f;--line:#304137;--warn:#e6ad67;--shadow:none}}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.65 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}.shell{width:min(1080px,calc(100% - 32px));margin:auto;padding:34px 0 60px}header{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:22px}h1{margin:0;font-size:clamp(28px,5vw,44px);letter-spacing:-.04em}h1 span{color:var(--green)}.subtitle{margin:5px 0 0;color:var(--muted)}.status{display:flex;gap:8px;flex-wrap:wrap}.pill{padding:5px 10px;border:1px solid var(--line);border-radius:999px;color:var(--muted);background:var(--card)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:var(--shadow)}.wide{grid-column:1/-1}h2{margin:0 0 14px;font-size:19px}label{display:block;margin:9px 0 5px;color:var(--muted);font-size:13px}input,select{width:100%;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--bg);color:var(--text);font:inherit}.row{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}button,.link-button{border:0;border-radius:10px;padding:10px 14px;background:var(--button);color:white;font:inherit;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none}.secondary{background:transparent;color:var(--green);border:1px solid var(--green)}.danger{background:#a53b32}button:disabled{opacity:.55;cursor:wait}.hint{color:var(--muted);font-size:13px;margin:10px 0 0}.warning{color:var(--warn)}pre{min-height:190px;max-height:420px;overflow:auto;white-space:pre-wrap;word-break:break-word;margin:0;background:#101713;color:#dce8df;border-radius:12px;padding:16px;font:13px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace}.empty{color:var(--muted)}@media(max-width:760px){header{align-items:flex-start;flex-direction:column}.grid{grid-template-columns:1fr}.wide{grid-column:auto}}
  </style>
</head>
<body><main class="shell">
  <header><div><h1><span>学语思</span> · 写作控制台</h1><p class="subtitle">写作、检查、发布都在这里完成，不用记命令。</p></div><div id="status" class="status"></div></header>
  <section class="grid">
    <div class="card"><h2>新建文章</h2><form id="new-form"><label for="title">文章标题</label><input id="title" required maxlength="100" placeholder="输入文章标题"><label for="slug">英文或拼音短名（可不填）</label><input id="slug" maxlength="80" placeholder="例如 my-new-article"><div class="row"><button type="submit">新建并打开 Obsidian</button></div></form><p class="hint">文章默认是草稿，不会直接上线。</p></div>
    <div class="card"><h2>当前文章</h2><label for="article">选择文章</label><select id="article"></select><div class="row"><a id="open-obsidian" class="link-button secondary" href="#">打开 Obsidian</a><button class="secondary" data-action="check">检查文章</button><button class="secondary" data-action="preview">预发布</button><button class="danger" data-action="publish">正式发布博客</button><button class="secondary" data-action="wechat">导出公众号版</button><button data-action="wechat-push">推送到公众号草稿箱</button></div><p class="hint warning">正式发布博客会提交并推送到线上；公众号按钮只创建草稿，不会自动群发。</p></div>
    <div class="card"><h2>公众号连接</h2><form id="wechat-form"><label for="wechat-app-id">AppID</label><input id="wechat-app-id" autocomplete="off" placeholder="公众号后台的开发者 ID"><label for="wechat-app-secret">AppSecret</label><input id="wechat-app-secret" type="password" autocomplete="new-password" placeholder="只保存在本机，不会上传 GitHub"><div class="row"><button type="submit">保存到本机</button></div></form><p id="wechat-status" class="hint">正在检查配置…</p></div>
    <div class="card"><h2>积压文章</h2><p class="hint">把公众号导出的 HTML、Markdown 或 TXT 放进导入目录，再在这里批量转为草稿。</p><div class="row"><button class="secondary" data-action="open-imports">打开导入目录</button><button class="secondary" data-action="import-preview">预览批量导入</button><button data-action="import">批量导入为草稿</button></div></div>
    <div class="card"><h2>系统与换电脑</h2><div class="row"><button class="secondary" data-action="doctor">系统体检</button><button class="secondary" data-action="handoff">换电脑盘点</button><button class="secondary" data-action="install">安装/修复依赖</button><a class="link-button secondary" href="https://zhuchengxue.github.io/" target="_blank" rel="noreferrer">打开博客</a></div><p class="hint">依赖安装只在新电脑首次使用或环境损坏时需要。</p></div>
    <div class="card wide"><h2>操作结果</h2><pre id="output">控制台已启动，正在读取文章…</pre><div class="row"><button class="secondary" data-action="refresh">刷新状态</button><button class="secondary" data-action="shutdown">关闭本地控制台</button></div></div>
  </section>
</main>
<script nonce="${nonce}">
const token=${JSON.stringify(token)};let state=null;let busy=false;let firstLoad=true;const output=document.querySelector('#output');const articleSelect=document.querySelector('#article');
async function request(path,options={}){const headers={...(options.headers||{}),'x-writing-token':token};const response=await fetch(path,{...options,headers});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'操作失败'),{data});return data}
function setBusy(value){busy=value;document.querySelectorAll('button').forEach(button=>button.disabled=value)}
function render(next){state=next;const status=document.querySelector('#status');status.textContent='';[['线上文章',next.legacy+next.publishedMarkdown],['草稿',next.drafts],['待导入',next.importFiles],['图片收件箱',next.inboxImages]].forEach(([label,value])=>{const span=document.createElement('span');span.className='pill';span.textContent=label+' '+value;status.append(span)});document.querySelector('#wechat-status').textContent=next.wechatConfigured?'已连接。可以把当前文章推送到公众号草稿箱。':'尚未配置。只需在每台电脑首次填写一次。';const selected=articleSelect.value;articleSelect.textContent='';for(const post of next.posts){const option=document.createElement('option');option.value=post.path;option.textContent=(post.draft?'草稿｜':'已发布｜')+post.title;articleSelect.append(option)}if(next.posts.some(post=>post.path===selected))articleSelect.value=selected;updateOpenLink();if(!next.dependenciesReady)output.textContent='尚未安装项目依赖。请点击“安装/修复依赖”，完成后即可检查和发布。'}
function updateOpenLink(){const post=state?.posts.find(item=>item.path===articleSelect.value);const link=document.querySelector('#open-obsidian');link.href=post?.obsidianUrl||'#';link.style.pointerEvents=post?'auto':'none'}articleSelect.addEventListener('change',updateOpenLink);
async function refresh(){try{render(await request('/api/state'));if(firstLoad){output.textContent='准备就绪。请选择文章或新建文章开始写作。';firstLoad=false}}catch(error){output.textContent=error.message}}
async function action(name,payload={}){if(busy)return;setBusy(true);output.textContent='正在执行，请稍候…';try{const result=await request('/api/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:name,...payload})});output.textContent=result.output||'操作完成。';await refresh();if(result.obsidianUrl)location.href=result.obsidianUrl;if(name==='shutdown')output.textContent='控制台已关闭，可以关闭这个页面。'}catch(error){output.textContent=(error.data?.output?error.data.output+String.fromCharCode(10,10):'')+error.message}finally{setBusy(false)}}
document.querySelector('#new-form').addEventListener('submit',event=>{event.preventDefault();action('new',{title:document.querySelector('#title').value,slug:document.querySelector('#slug').value})});
document.querySelector('#wechat-form').addEventListener('submit',event=>{event.preventDefault();const appId=document.querySelector('#wechat-app-id').value.trim();const appSecret=document.querySelector('#wechat-app-secret').value.trim();if(!appId||!appSecret){output.textContent='请同时填写 AppID 和 AppSecret。';return}action('wechat-config',{appId,appSecret});document.querySelector('#wechat-app-secret').value=''});
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{const name=button.dataset.action;if(name==='refresh')return refresh();const article=articleSelect.value;if(['check','preview','wechat'].includes(name))return action(name,{article});if(name==='wechat-push'){if(confirm('确定把这篇文章上传到公众号草稿箱吗？不会自动群发。'))return action(name,{article,confirmation:article});return}if(name==='publish'){if(confirm('确定正式发布这篇文章吗？这会提交并推送到博客。'))return action(name,{article,confirmation:article});return}if(name==='import'){if(confirm('确定把导入目录中的文件批量转换为草稿吗？'))return action(name,{confirmation:'import'});return}if(name==='install'){if(confirm('确定安装或修复项目依赖吗？需要访问 npm 软件源。'))return action(name,{confirmation:'install'});return}action(name)}));refresh();
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
    const articleActions = new Set(['check', 'preview', 'publish', 'wechat', 'wechat-push']);
    if (articleActions.has(action) && !selected) return sendJSON(response, 400, { error: '请选择有效文章。' });
    if (action === 'publish' && payload.confirmation !== selected.path) return sendJSON(response, 400, { error: '正式发布确认失败。' });
    if (action === 'wechat-push' && payload.confirmation !== selected.path) return sendJSON(response, 400, { error: '公众号草稿推送确认失败。' });
    if (action === 'import' && payload.confirmation !== 'import') return sendJSON(response, 400, { error: '批量导入确认失败。' });
    if (action === 'install' && payload.confirmation !== 'install') return sendJSON(response, 400, { error: '依赖安装确认失败。' });

    let command;
    if (action === 'new') {
      const title = String(payload.title || '').trim();
      const slug = String(payload.slug || '').trim();
      if (!title || title.length > 100 || slug.length > 80) return sendJSON(response, 400, { error: '请填写有效标题，短名不能超过 80 个字符。' });
      command = ['node', ['scripts/new-post.mjs', title, ...(slug ? [slug] : [])]];
    } else if (action === 'check') command = ['node', ['scripts/check-post-ready.mjs', selected.path]];
    else if (action === 'preview') command = ['node', ['scripts/publish-post.mjs', selected.path, '--dry-run']];
    else if (action === 'publish') command = ['node', ['scripts/publish-post.mjs', selected.path]];
    else if (action === 'wechat') command = ['node', ['scripts/generate-wechat.mjs', selected.path]];
    else if (action === 'wechat-push') command = ['node', ['scripts/push-wechat.mjs', selected.path]];
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

    activeOperation = action;
    const result = await runProcess(command[0], command[1]);
    activeOperation = null;
    let obsidianUrl;
    if (action === 'new' && result.ok) {
      const createdPath = result.output.match(/^已创建：(.+)$/m)?.[1]?.trim();
      const createdRelative = createdPath ? relative(workspace, resolve(createdPath)).replaceAll('\\', '/') : '';
      obsidianUrl = listPosts().find((post) => post.path === createdRelative)?.obsidianUrl;
    }
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
