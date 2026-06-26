import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const online = args.includes('--online');
const allowDirty = args.includes('--allow-dirty');
const siteURL = (process.env.SITE_URL || 'https://zhuchengxue.github.io').replace(/\/$/, '');
const results = [];

function check(label, ok, detail = '') {
  results.push({ label, ok, detail });
}

function readJSON(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function command(commandName, commandArgs) {
  return spawnSync(commandName, commandArgs, {
    encoding: 'utf8'
  });
}

function envState(name) {
  return process.env[name] ? '已配置' : '未配置';
}

async function fetchText(path, { timeout = 15000, attempts = 2 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(`${siteURL}${path}`, {
        signal: AbortSignal.timeout(timeout)
      });
      const text = await response.text();
      return { response, text, attempt };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolveRetry) => setTimeout(resolveRetry, 1000));
    }
  }
  throw lastError;
}

const packageJson = readJSON('package.json');
for (const script of ['dev', 'new', 'prepare', 'publish', 'wechat', 'wechat:draft', 'import:wechat', 'mirror', 'config:services', 'status', 'og:images', 'build', 'build:ci', 'audit', 'doctor']) {
  check(`npm script: ${script}`, Boolean(packageJson.scripts?.[script]));
}

for (const path of [
  '.github/workflows/deploy.yml',
  '.obsidian/app.json',
  'templates/article.md',
  'src/content/posts/2026-06-24-welcome.md',
  'src/content/legacy-posts.json',
  'src/pages/articles.astro',
  'src/pages/tags/index.astro',
  'src/pages/rss.xml.ts',
  'src/pages/sitemap.xml.ts',
  'scripts/generate-wechat.mjs',
  'scripts/create-wechat-draft.mjs',
  'scripts/import-wechat.mjs',
  'scripts/deploy-mirror.mjs',
  'scripts/configure-services.mjs',
  'scripts/status-report.mjs',
  'scripts/run-astro.mjs',
  'scripts/generate-og-images.mjs',
  'scripts/generate-search-index.mjs'
]) {
  check(`关键文件: ${path}`, existsSync(resolve(path)));
}

const gitStatus = command('git', ['-c', 'safe.directory=C:/Users/zhuch/Documents/个人博客网站', 'status', '--short']);
const gitDirty = gitStatus.status !== 0 || gitStatus.stdout.trim() !== '';
check('Git 工作区干净', !gitDirty || allowDirty, gitDirty ? (allowDirty ? '当前有未提交改动；已通过 --allow-dirty 放行' : gitStatus.stdout.trim() || gitStatus.stderr.trim()) : '');

const legacyPosts = readJSON('src/content/legacy-posts.json');
check('旧文数量', legacyPosts.length === 70, `${legacyPosts.length} 篇`);

const distExists = existsSync(resolve('dist/index.html'));
check('构建产物 dist/', distExists, distExists ? '已存在' : '请先运行 npm run build');
if (distExists) {
  const home = readFileSync(resolve('dist/index.html'), 'utf8');
  const welcome = readFileSync(resolve('dist/posts/2026-06-24-welcome/index.html'), 'utf8');
  check('构建产物由 Astro 生成', home.includes('name="generator" content="Astro'));
  check('默认不加载评论/统计脚本', !/giscus\.app|umami|data-website-id/i.test(welcome));
  check('文章 SEO 元数据', welcome.includes('article:published_time') && welcome.includes('og:image'));
  check('文章级 OG 分享图引用', welcome.includes('/og/posts/2026-06-24-welcome/index.svg'));
  check('Manifest 产物', existsSync(resolve('dist/site.webmanifest')));
  check('RSS 产物', existsSync(resolve('dist/rss.xml')));
  const searchIndexPath = resolve('dist/search.json');
  check('全文搜索索引产物', existsSync(searchIndexPath));
  if (existsSync(searchIndexPath)) {
    const search = readFileSync(searchIndexPath, 'utf8');
    check('全文搜索索引数量', JSON.parse(search).length === 71, `${JSON.parse(search).length} 篇`);
    check('全文搜索包含正文关键词', search.includes('Chrome'));
  }
  check('Sitemap 产物', existsSync(resolve('dist/sitemap.xml')));
  check('文章级 OG 分享图产物', existsSync(resolve('dist/og/posts/2026-06-24-welcome/index.svg')));
}

check('SITE_URL', true, process.env.SITE_URL || '默认 https://zhuchengxue.github.io');
check('CUSTOM_DOMAIN', true, envState('CUSTOM_DOMAIN'));
check('Giscus 评论配置', true, ['PUBLIC_GISCUS_REPO', 'PUBLIC_GISCUS_REPO_ID', 'PUBLIC_GISCUS_CATEGORY', 'PUBLIC_GISCUS_CATEGORY_ID'].map((name) => `${name}:${envState(name)}`).join(' '));
check('Umami 统计配置', true, ['PUBLIC_UMAMI_SCRIPT', 'PUBLIC_UMAMI_WEBSITE_ID'].map((name) => `${name}:${envState(name)}`).join(' '));
check('微信公众号草稿配置', true, ['WECHAT_APP_ID', 'WECHAT_APP_SECRET', 'WECHAT_THUMB_MEDIA_ID'].map((name) => `${name}:${envState(name)}`).join(' '));
check('镜像配置', true, ['MIRROR_REPO', 'MIRROR_BRANCH', 'MIRROR_DOMAIN'].map((name) => `${name}:${envState(name)}`).join(' '));

if (online) {
  const onlinePages = [
    ['/', 'name="generator" content="Astro'],
    ['/articles/', '/search.json'],
    ['/site.webmanifest', '学语思'],
    ['/rss.xml', '<rss'],
    ['/sitemap.xml', '<urlset'],
    ['/posts/2026-06-24-welcome/', '/og/posts/2026-06-24-welcome/index.svg'],
    ['/og/posts/2026-06-24-welcome/index.svg', '<svg']
  ];

  for (const [path, expectedText] of onlinePages) {
    try {
      const { response, text } = await fetchText(path);
      check(`线上访问: ${path}`, response.ok, `${response.status} ${response.statusText}`);
      check(`线上内容: ${path}`, response.ok && text.includes(expectedText), expectedText);
    } catch (error) {
      check(`线上访问: ${path}`, false, error.message);
    }
  }

  try {
    const { response, text } = await fetchText('/search.json', { timeout: 30000, attempts: 3 });
    check('线上访问: /search.json', response.ok, `${response.status} ${response.statusText}`);
    const search = JSON.parse(text);
    check('线上全文搜索数量', Array.isArray(search) && search.length === 71, `${Array.isArray(search) ? search.length : 0} 篇`);
    check('线上全文搜索包含正文关键词', text.includes('Chrome'));
  } catch (error) {
    check('线上访问: /search.json', false, error.message);
  }
} else {
  check('线上访问检查', true, '跳过；如需检查运行 npm run doctor -- --online');
}

const failed = results.filter((result) => !result.ok);
for (const result of results) {
  const mark = result.ok ? '✓' : '✗';
  console.log(`${mark} ${result.label}${result.detail ? ` — ${result.detail}` : ''}`);
}

if (failed.length) {
  console.error(`诊断失败：${failed.length} 项需要处理。`);
  process.exit(1);
}

console.log('诊断通过。');
