import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const online = args.includes('--online');
const siteURL = (process.env.SITE_URL || 'https://zhuchengxue.github.io').replace(/\/$/, '');

function exists(path) {
  return existsSync(resolve(path));
}

function read(path) {
  return readFileSync(resolve(path), 'utf8');
}

function json(path) {
  return JSON.parse(read(path));
}

function env(name) {
  return Boolean(process.env[name]);
}

function state(ok, detail = '') {
  return `${ok ? '✅' : '⬜'} ${detail}`;
}

function optional(name, names, note) {
  const count = names.filter(env).length;
  const configured = count === names.length;
  const partial = count > 0 && !configured;
  return {
    name,
    configured,
    partial,
    detail: configured
      ? '已配置'
      : partial
        ? `部分配置：${count}/${names.length}，请补齐 ${names.filter((name) => !env(name)).join(', ')}${note ? `；${note}` : ''}`
        : `待外部配置：${names.join(', ')}${note ? `；${note}` : ''}`
  };
}

async function fetchOK(path, expected) {
  try {
    const response = await fetch(`${siteURL}${path}`, {
      signal: AbortSignal.timeout(20000)
    });
    const text = await response.text();
    return {
      ok: response.ok && (!expected || text.includes(expected)),
      detail: `${response.status} ${response.statusText}`
    };
  } catch (error) {
    return { ok: false, detail: error.message };
  }
}

const packageJson = json('package.json');
const scripts = packageJson.scripts || {};
const legacyCount = exists('src/content/legacy-posts.json') ? json('src/content/legacy-posts.json').length : 0;
const distReady = exists('dist/index.html');
const searchCount = exists('dist/search.json') ? json('dist/search.json').length : 0;

const phase1 = [
  ['Astro 博客结构', exists('astro.config.mjs') && exists('src/pages/index.astro') && exists('src/pages/articles.astro')],
  ['首页 / 文章页 / 标签页 / 关于页', exists('src/pages/index.astro') && exists('src/pages/posts/[...slug].astro') && exists('src/pages/tags/index.astro') && exists('src/pages/about.astro')],
  ['深色模式', exists('src/styles/global.css') && read('src/styles/global.css').includes('@media (prefers-color-scheme: dark)')],
  ['RSS / Atom / Sitemap', exists('src/pages/rss.xml.ts') && exists('src/pages/atom.xml.ts') && exists('src/pages/sitemap.xml.ts')],
  ['GitHub Pages 自动部署', exists('.github/workflows/deploy.yml') && read('.github/workflows/deploy.yml').includes('deploy-pages')]
];

const phase2 = [
  ['Obsidian Vault 配置', exists('.obsidian/app.json') && exists('.obsidian/templates.json')],
  ['统一文章模板', exists('templates/article.md')],
  ['统一图片目录', exists('public/images/inbox/.gitkeep') && exists('scripts/prepare-post.mjs')],
  ['发布前体检脚本', Boolean(scripts.ready) && exists('scripts/check-post-ready.mjs')],
  ['一键发布脚本', Boolean(scripts.publish) && exists('scripts/publish-post.mjs')]
];

const wechatScript = exists('scripts/generate-wechat.mjs') ? read('scripts/generate-wechat.mjs') : '';
const phase3 = [
  ['公众号 HTML / JSON 生成', Boolean(scripts.wechat) && exists('scripts/generate-wechat.mjs')],
  ['图片路径转线上绝对地址', wechatScript.includes('SITE_ORIGIN') && wechatScript.includes('publicUrl')],
  ['保留博客原文链接', wechatScript.includes('content_source_url')],
  ['可选草稿 API', Boolean(scripts['wechat:draft']) && exists('scripts/create-wechat-draft.mjs')]
];

const configText = exists('src/config.ts') ? read('src/config.ts') : '';
const baseLayout = exists('src/layouts/BaseLayout.astro') ? read('src/layouts/BaseLayout.astro') : '';
const phase4 = [
  ['搜索', Boolean(scripts['search:index']) && exists('scripts/generate-search-index.mjs') && (!distReady || searchCount === 71)],
  ['评论入口', configText.includes('PUBLIC_GISCUS_REPO')],
  ['访问统计入口', configText.includes('PUBLIC_UMAMI_SCRIPT')],
  ['SEO / Open Graph', baseLayout.includes('og:image') && exists('scripts/generate-og-images.mjs')],
  ['旧公众号文章迁移入口', Boolean(scripts['import:wechat']) && exists('scripts/import-wechat.mjs') && legacyCount === 70],
  ['国内访问镜像入口', Boolean(scripts.mirror) && exists('scripts/deploy-mirror.mjs')]
];

const external = [
  optional('独立域名', ['SITE_URL', 'CUSTOM_DOMAIN'], '未配置时默认使用 GitHub Pages 域名'),
  optional('Giscus 评论', ['PUBLIC_GISCUS_REPO', 'PUBLIC_GISCUS_REPO_ID', 'PUBLIC_GISCUS_CATEGORY', 'PUBLIC_GISCUS_CATEGORY_ID'], '保持未配置可继续零第三方脚本'),
  optional('Umami 统计', ['PUBLIC_UMAMI_SCRIPT', 'PUBLIC_UMAMI_WEBSITE_ID'], '保持未配置可继续零第三方脚本'),
  optional('公众号草稿 API', ['WECHAT_APP_ID', 'WECHAT_APP_SECRET', 'WECHAT_THUMB_MEDIA_ID'], '没有接口权限时继续手动复制 HTML'),
  optional('国内镜像', ['MIRROR_REPO', 'MIRROR_BRANCH'], '最低成本策略是需要时手动同步')
];

function printPhase(title, items) {
  const done = items.filter(([, ok]) => ok).length;
  console.log(`\n${title}：${done}/${items.length}`);
  for (const [label, ok] of items) {
    console.log(`  ${state(ok, label)}`);
  }
}

console.log('博客状态报告');
console.log(`站点：${siteURL}`);
console.log(`文章：${legacyCount + 1} 篇（新文章 1 篇，旧文章 ${legacyCount} 篇）`);
console.log(`构建产物：${distReady ? '已存在' : '未生成，请运行 npm run build'}`);

printPhase('第一阶段：最小可用博客', phase1);
printPhase('第二阶段：接入写作库', phase2);
printPhase('第三阶段：公众号分发', phase3);
printPhase('第四阶段：完善能力', phase4);

console.log('\n外部配置状态：');
for (const item of external) {
  const mark = item.configured ? '✅' : item.partial ? '⚠️' : '⬜';
  console.log(`  ${mark} ${item.name} — ${item.detail}`);
}

if (online) {
  console.log('\n线上验证：');
  const checks = [
    ['首页', '/', 'name="generator" content="Astro'],
    ['文章列表', '/articles/', '/search.json'],
    ['RSS', '/rss.xml', '<rss'],
    ['Sitemap', '/sitemap.xml', '<urlset'],
    ['搜索索引', '/search.json', 'Chrome'],
    ['示例文章', '/posts/2026-06-24-welcome/', '/og/posts/2026-06-24-welcome/index.svg'],
    ['示例文章分享图', '/og/posts/2026-06-24-welcome/index.svg', '<svg']
  ];

  for (const [label, path, expected] of checks) {
    const result = await fetchOK(path, expected);
    console.log(`  ${state(result.ok, `${label} ${path} — ${result.detail}`)}`);
  }
}

console.log('\n建议下一步：');
console.log('  1. 日常写作：npm run new → Obsidian 编辑 → npm run ready → npm run publish');
console.log('  2. 发公众号：博客上线后运行 npm run wechat，再复制 HTML 到公众号后台');
console.log('  3. 需要外部服务时运行 npm run config:services 生成配置清单');
