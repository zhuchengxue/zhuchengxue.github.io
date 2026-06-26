import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const failures = [];

function mustExist(path, label) {
  if (!existsSync(resolve(path))) failures.push(`${label}: 缺少 ${path}`);
}

function mustInclude(path, pattern, label) {
  const fullPath = resolve(path);
  if (!existsSync(fullPath)) {
    failures.push(`${label}: 缺少 ${path}`);
    return;
  }

  const text = readFileSync(fullPath, 'utf8');
  if (pattern instanceof RegExp) {
    if (!pattern.test(text)) failures.push(`${label}: ${path} 未匹配 ${pattern}`);
  } else if (!text.includes(pattern)) {
    failures.push(`${label}: ${path} 未包含 ${pattern}`);
  }
}

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
for (const script of ['new', 'prepare', 'publish', 'wechat', 'wechat:draft', 'import:wechat', 'search:index', 'build', 'build:ci', 'audit', 'doctor']) {
  if (!packageJson.scripts?.[script]) failures.push(`package.json: 缺少 npm script ${script}`);
}
if (!packageJson.scripts?.mirror) failures.push('package.json: 缺少 npm script mirror');

for (const [path, label] of [
  ['src/pages/index.astro', '首页'],
  ['src/pages/posts/[...slug].astro', '新文章页'],
  ['src/pages/[year]/[month]/[day]/[slug].astro', '旧文章页'],
  ['src/pages/tags/index.astro', '标签索引'],
  ['src/pages/tags/[tag].astro', '标签详情'],
  ['src/pages/about.astro', '关于页'],
  ['src/pages/rss.xml.ts', 'RSS'],
  ['src/pages/atom.xml.ts', 'Atom'],
  ['src/pages/sitemap.xml.ts', '站点地图'],
  ['src/pages/site.webmanifest.ts', 'Manifest'],
  ['src/layouts/BaseLayout.astro', '基础布局'],
  ['src/layouts/PostLayout.astro', '文章布局'],
  ['src/styles/global.css', '全局样式'],
  ['.github/workflows/deploy.yml', 'GitHub Pages 部署'],
  ['.obsidian/app.json', 'Obsidian 配置'],
  ['templates/article.md', '文章模板'],
  ['scripts/new-post.mjs', '新建文章脚本'],
  ['scripts/prepare-post.mjs', '图片整理脚本'],
  ['scripts/publish-post.mjs', '一键发布脚本'],
  ['scripts/generate-wechat.mjs', '公众号分发脚本'],
  ['scripts/create-wechat-draft.mjs', '公众号草稿脚本'],
  ['scripts/import-wechat.mjs', '旧公众号导入脚本'],
  ['scripts/deploy-mirror.mjs', '镜像发布脚本'],
  ['scripts/generate-search-index.mjs', '全文搜索索引脚本'],
  ['scripts/doctor.mjs', '站点诊断脚本'],
  ['docs/OPERATIONS.md', '博客运维手册'],
  ['docs/ACCEPTANCE.md', '四阶段验收清单'],
  ['imports/wechat/.gitkeep', '旧公众号导入目录'],
  ['.env.example', '环境变量模板']
]) {
  mustExist(path, label);
}

mustInclude('src/styles/global.css', '@media (prefers-color-scheme: dark)', '深色模式');
mustInclude('src/pages/articles.astro', 'search.json', '文章全文搜索');
mustInclude('scripts/generate-search-index.mjs', 'public/search.json', '静态全文搜索索引生成');
mustInclude('src/layouts/BaseLayout.astro', 'application/ld+json', '结构化数据');
mustInclude('src/layouts/BaseLayout.astro', 'og:image', 'Open Graph');
mustInclude('src/config.ts', 'PUBLIC_GISCUS_REPO', '可选评论');
mustInclude('src/config.ts', 'PUBLIC_UMAMI_SCRIPT', '可选统计');
mustInclude('.github/workflows/deploy.yml', 'CUSTOM_DOMAIN', '独立域名 CNAME');
mustInclude('.github/workflows/deploy.yml', 'SITE_URL', '独立域名 URL');
mustInclude('scripts/generate-wechat.mjs', 'content_source_url', '公众号原文链接');
mustInclude('scripts/generate-wechat.mjs', 'exports/wechat', '公众号输出目录');
mustInclude('scripts/create-wechat-draft.mjs', 'draft/add', '公众号草稿 API');
mustInclude('scripts/create-wechat-draft.mjs', 'WECHAT_APP_SECRET', '公众号凭据环境变量');
mustInclude('scripts/import-wechat.mjs', 'draft: true', '旧公众号导入为草稿');
mustInclude('scripts/deploy-mirror.mjs', 'MIRROR_REPO', '国内访问镜像发布');
mustInclude('scripts/doctor.mjs', 'site.webmanifest', '线上站点诊断');
mustInclude('docs/OPERATIONS.md', 'npm run doctor -- --online', '运维手册线上诊断');
mustInclude('docs/ACCEPTANCE.md', '第一阶段：最小可用博客', '验收清单第一阶段');
mustInclude('docs/ACCEPTANCE.md', '可选启用', '验收清单外部条件标记');
mustInclude('README.md', '国内访问镜像', '国内访问镜像说明');

if (existsSync(resolve('dist/index.html'))) {
  mustInclude('dist/index.html', 'name="generator" content="Astro', '构建产物');
  mustInclude('dist/rss.xml', '<rss', 'RSS 产物');
  mustInclude('dist/search.json', 'Chrome', '全文搜索索引产物');
  mustInclude('dist/sitemap.xml', '<urlset', '站点地图产物');
  mustInclude('dist/site.webmanifest', '"name"', 'Manifest 产物');

  const welcome = 'dist/posts/2026-06-24-welcome/index.html';
  mustInclude(welcome, 'article:published_time', '文章 SEO 产物');
  const html = readFileSync(resolve(welcome), 'utf8');
  if (/giscus\.app|umami|data-website-id/i.test(html)) {
    failures.push('默认构建产物不应加载评论或统计第三方脚本');
  }
} else {
  failures.push('dist/: 缺少构建产物，请先运行 npm run build');
}

if (failures.length) {
  console.error('目标审计失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('目标审计通过：四阶段核心交付物已具备可验证证据；外部依赖项已在 docs/ACCEPTANCE.md 标记为可选启用或待输入。');
