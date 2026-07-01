import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import { listDropboxArticles } from './lib/dropbox-articles.mjs';
import { readLocalEnv, updateLocalEnv } from './lib/local-env.mjs';
import { syncArticle, wechatIsConfigured } from './lib/sync-article.mjs';

const projectRoot = resolve('.');
const token = randomBytes(24).toString('hex');
const defaultPort = Number(process.argv.find((arg) => arg.startsWith('--port='))?.split('=')[1] || 4180);
const noOpen = process.argv.includes('--no-open');

function existingArticles() {
  const directory = resolve(projectRoot, 'src/content/posts');
  if (!existsSync(directory)) return { byTitle: new Map(), bySourceId: new Map() };
  const records = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => {
      try {
        const parsed = matter(readFileSync(resolve(directory, entry.name), 'utf8'));
        return {
          title: String(parsed.data.title || '').trim(),
          sourceId: String(parsed.data.sourceId || '').normalize('NFC'),
          filename: entry.name,
          published: parsed.data.draft === false
        };
      } catch {
        return null;
      }
    }).filter(Boolean);
  return {
    byTitle: new Map(records.filter((item) => item.title).map((item) => [item.title, item])),
    bySourceId: new Map(records.filter((item) => item.sourceId).map((item) => [item.sourceId, item]))
  };
}

function publicState(vaultPath) {
  const localEnv = readLocalEnv();
  const collection = listDropboxArticles({ vaultPath });
  const targets = existingArticles();
  return {
    vaultPath: collection.vaultPath,
    wechatConfigured: wechatIsConfigured(),
    wechatAppId: localEnv.WECHAT_APP_ID || process.env.WECHAT_APP_ID || '',
    siteUrl: localEnv.SITE_URL || process.env.SITE_URL || 'https://zhuchengxue.github.io',
    articles: collection.articles.map((article) => {
      const target = targets.bySourceId.get(article.sourceId) || targets.byTitle.get(article.title);
      return {
        id: article.id,
        title: article.title,
        relativePath: article.relativePath,
        archived: article.archived,
        modifiedAt: article.modifiedAt,
        published: Boolean(target?.published),
        targetFilename: target?.filename || ''
      };
    }).sort((a, b) => Number(a.published) - Number(b.published)
      || Number(a.archived) - Number(b.archived)
      || b.modifiedAt.localeCompare(a.modifiedAt))
  };
}

function json(response, status, value) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  });
  response.end(JSON.stringify(value));
}

function readBody(request) {
  return new Promise((resolveBody, reject) => {
    let source = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      source += chunk;
      if (source.length > 64 * 1024) reject(new Error('请求内容过大。'));
    });
    request.on('end', () => {
      try { resolveBody(source ? JSON.parse(source) : {}); }
      catch { reject(new Error('请求格式错误。')); }
    });
    request.on('error', reject);
  });
}

function escapeScriptJSON(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function renderPage(state) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>发布文章 · 学语思</title>
  <style>
    :root{color-scheme:light;--ink:#17362b;--muted:#6c7a74;--line:#dfe7e2;--paper:#fff;--wash:#f5f8f6;--green:#246b4d;--green2:#1d593f;--soft:#eaf2ed;--error:#a73b32}
    *{box-sizing:border-box} body{margin:0;background:var(--wash);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
    main{width:min(680px,calc(100% - 32px));margin:9vh auto 48px} header{text-align:center;margin-bottom:30px} h1{font-size:clamp(30px,6vw,46px);line-height:1.15;margin:0 0 10px;letter-spacing:-.04em} header p{margin:0;color:var(--muted)}
    .card{background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:clamp(22px,5vw,38px);box-shadow:0 18px 50px rgba(26,65,49,.07)}
    label{display:block;font-size:14px;color:var(--muted);margin-bottom:8px} select,input{width:100%;height:52px;border:1px solid #cfdbd4;border-radius:12px;background:#fff;color:var(--ink);font:inherit;padding:0 14px;outline:none} select:focus,input:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(36,107,77,.1)}
    button{width:100%;height:54px;margin-top:18px;border:0;border-radius:12px;background:var(--green);color:#fff;font:700 16px/1 inherit;cursor:pointer} button:hover{background:var(--green2)} button:disabled{opacity:.55;cursor:wait}
    .hint{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:16px 0 0;color:var(--muted);font-size:13px}.dot{color:#b4beb8}
    #message{display:none;margin-top:18px;padding:13px 15px;border-radius:12px;background:var(--soft);font-size:14px} #message.show{display:block} #message.error{background:#fbefed;color:var(--error)} #message a{color:var(--green);font-weight:650}
    details{margin-top:18px;border-top:1px solid var(--line);padding-top:16px;color:var(--muted)} summary{cursor:pointer;font-size:14px;list-style:none} summary::-webkit-details-marker{display:none} summary:before{content:"›";display:inline-block;margin-right:7px;transition:.15s} details[open] summary:before{transform:rotate(90deg)}
    .settings{display:grid;gap:14px;margin-top:18px}.settings button{height:44px;margin-top:2px;background:#edf3ef;color:var(--green)}.small{font-size:12px;color:var(--muted);margin:-7px 0 0}.empty{padding:24px;text-align:center;color:var(--muted)}
    @media(max-width:520px){main{margin-top:32px}.card{border-radius:16px}}
  </style>
</head>
<body>
<main>
  <header><h1>发布文章</h1><p>从 Dropbox 选择，一次同步到博客和公众号草稿箱。</p></header>
  <section class="card">
    <div id="picker">
      <label for="article">Dropbox 文章</label>
      <select id="article"></select>
      <button id="publish">同步到博客</button>
      <div class="hint"><span id="vaultStatus">Dropbox · 已连接</span><span class="dot">·</span><span id="wechatStatus"></span></div>
      <div id="message"></div>
    </div>
    <details>
      <summary>本机设置</summary>
      <form class="settings" id="settings">
        <div><label for="vault">Dropbox 写作库</label><input id="vault" autocomplete="off"></div>
        <div><label for="siteUrl">博客网址（以后可替换为独立域名）</label><input id="siteUrl" type="url" autocomplete="url" placeholder="https://你的域名"></div>
        <div><label for="appId">公众号 AppID</label><input id="appId" autocomplete="off"></div>
        <div><label for="appSecret">公众号 AppSecret</label><input id="appSecret" type="password" autocomplete="new-password" placeholder="已保存则留空"></div>
        <p class="small">这些信息只保存在当前电脑，不会进入 Dropbox 或 GitHub。</p>
        <button type="submit">保存本机设置</button>
      </form>
    </details>
  </section>
</main>
<script>
  const initial=${escapeScriptJSON(state)};
  const auth=${JSON.stringify(token)};
  const article=document.querySelector('#article');
  const publish=document.querySelector('#publish');
  const message=document.querySelector('#message');
  const settings=document.querySelector('#settings');
  let current=initial;
  function render(state){
    current=state; article.innerHTML='';
    for(const item of state.articles){const option=document.createElement('option');option.value=item.id;option.textContent=item.title+(item.published?' · 已发布':' · 未发布');article.append(option)}
    article.disabled=!state.articles.length; publish.disabled=!state.articles.length;
    publish.textContent=state.wechatConfigured?'同步到博客和公众号草稿箱':'同步到博客';
    document.querySelector('#wechatStatus').textContent=state.wechatConfigured?'公众号 · 已连接':'公众号 · 未连接';
    document.querySelector('#vault').value=state.vaultPath||''; document.querySelector('#siteUrl').value=state.siteUrl||''; document.querySelector('#appId').value=state.wechatAppId||'';
    if(!state.articles.length) show('Dropbox 写作库中还没有 Markdown 文章。',true);
  }
  function show(html,error=false){message.innerHTML=html;message.className='show'+(error?' error':'')}
  function safe(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
  async function api(path,body){const response=await fetch(path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-publisher-token':auth},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw new Error(data.error||'操作失败');return data}
  publish.addEventListener('click',async()=>{
    publish.disabled=true;article.disabled=true;show('正在同步，请稍候…');
    let polling;
    try{
      polling=setInterval(async()=>{try{const p=await api('/api/progress');if(p.message)show(p.message)}catch{}},900);
      const result=await api('/api/sync',{articleId:article.value,wechat:current.wechatConfigured});clearInterval(polling);
      const wechat=result.wechatCreated?'，并已进入公众号草稿箱':'';
      const archive=result.archiveWarning?'<br><span style="color:#a73b32">'+safe(result.archiveWarning)+'</span>':'';
      show('同步完成'+wechat+'。<br><a href="'+result.articleUrl+'" target="_blank" rel="noreferrer">查看博客文章</a>'+archive+'<br><span style="color:#6c7a74">GitHub Pages 通常需要一两分钟上线；发布器会自动退出。</span>');
      publish.textContent='同步完成';
    }catch(error){clearInterval(polling);show(safe(error.message).replace(/\\n/g,'<br>'),true);publish.disabled=false;article.disabled=false}
  });
  settings.addEventListener('submit',async(event)=>{event.preventDefault();const button=settings.querySelector('button');button.disabled=true;try{const state=await api('/api/settings',{vaultPath:document.querySelector('#vault').value.trim(),siteUrl:document.querySelector('#siteUrl').value.trim(),appId:document.querySelector('#appId').value.trim(),appSecret:document.querySelector('#appSecret').value});document.querySelector('#appSecret').value='';render(state);show('本机设置已保存。')}catch(error){show(error.message,true)}finally{button.disabled=false}});
  render(initial);
</script>
</body></html>`;
}

function openURL(url) {
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(command, [url], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

export function createPublisherServer(options = {}) {
  let vaultPath = options.vaultPath;
  let currentJob = null;
  let progress = '';
  let inactivityTimer;
  const server = http.createServer(async (request, response) => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => server.close(), options.inactivityMs || 10 * 60 * 1000);
    if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(request.headers.host || '')) {
      return json(response, 403, { error: '发布器只接受本机请求。' });
    }
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname !== '/' && request.headers['x-publisher-token'] !== token) {
      return json(response, 403, { error: '本机会话已失效，请重新打开发布器。' });
    }
    try {
      if (request.method === 'GET' && url.pathname === '/') {
        const state = publicState(vaultPath);
        vaultPath = state.vaultPath;
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'no-referrer'
        });
        return response.end(renderPage(state));
      }
      if (request.method === 'GET' && url.pathname === '/api/progress') return json(response, 200, { message: progress });
      if (request.method === 'POST' && url.pathname === '/api/settings') {
        const body = await readBody(request);
        const updates = {};
        if (body.vaultPath) updates.WRITING_VAULT = body.vaultPath;
        if (body.siteUrl) {
          if (!/^https:\/\/[^\s]+$/i.test(body.siteUrl)) throw new Error('博客网址必须是完整的 https:// 地址。');
          updates.SITE_URL = body.siteUrl.replace(/\/$/, '');
        }
        updates.WECHAT_APP_ID = body.appId || '';
        if (body.appSecret) updates.WECHAT_APP_SECRET = body.appSecret;
        updateLocalEnv(updates);
        Object.assign(process.env, updates);
        vaultPath = body.vaultPath || vaultPath;
        return json(response, 200, publicState(vaultPath));
      }
      if (request.method === 'POST' && url.pathname === '/api/sync') {
        if (currentJob) return json(response, 409, { error: '已有一篇文章正在同步。' });
        const body = await readBody(request);
        progress = '正在开始同步…';
        currentJob = syncArticle({
          articleId: body.articleId,
          wechat: Boolean(body.wechat),
          vaultPath,
          projectRoot,
          onProgress: (message) => { progress = message; }
        });
        try {
          const result = await currentJob;
          json(response, 200, result);
          setTimeout(() => server.close(), options.successCloseMs || 4000);
          return;
        } finally {
          currentJob = null;
        }
      }
      return json(response, 404, { error: '页面不存在。' });
    } catch (error) {
      progress = '';
      return json(response, 500, { error: error.message || '操作失败。' });
    }
  });
  server.on('close', () => clearTimeout(inactivityTimer));
  inactivityTimer = setTimeout(() => server.close(), options.inactivityMs || 10 * 60 * 1000);
  server.cancelInactivityTimer = () => clearTimeout(inactivityTimer);
  return server;
}

async function main() {
  const server = createPublisherServer();
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      server.cancelInactivityTimer();
      if (!noOpen) openURL(`http://127.0.0.1:${defaultPort}/`);
      return;
    }
    console.error(`发布器启动失败：${error.message}`);
    process.exitCode = 1;
  });
  server.listen(defaultPort, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${defaultPort}/`;
    console.log(`发布器已启动：${url}`);
    if (!noOpen) openURL(url);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
