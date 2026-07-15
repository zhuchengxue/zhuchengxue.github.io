import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { contentCounts } from './lib/content-count.mjs';

const legacyPosts = JSON.parse(readFileSync(resolve('src/content/legacy-posts.json'), 'utf8'));
const counts = contentCounts();
const failures = [];

function plainText(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

for (const post of legacyPosts) {
  const output = resolve('dist', post.href.slice(1), 'index.html');
  if (!existsSync(output)) {
    failures.push(`${post.href}: 未生成页面`);
    continue;
  }

  const html = readFileSync(output, 'utf8');
  const sourceSnippet = plainText(post.html).slice(0, 80);
  const outputText = plainText(html);

  if (!html.includes('name="generator" content="Astro')) {
    failures.push(`${post.href}: 页面不是由 Astro 生成`);
  }
  if (/hexo-theme-next|\/css\/main\.css|class="post-body"|adsbygoogle/i.test(html)) {
    failures.push(`${post.href}: 最终页面仍含 Hexo 主题内容`);
  }
  if (sourceSnippet && !outputText.includes(sourceSnippet)) {
    failures.push(`${post.href}: 正文片段未出现在最终页面`);
  }
}

for (const path of [
  'dist/lib',
  'dist/css/main.css',
  'dist/js/src/bootstrap.js',
  'dist/images/favicon.ico'
]) {
  if (existsSync(resolve(path))) failures.push(`${path}: 旧主题资源仍存在`);
}

for (const file of walk(resolve('dist')).filter((path) => path.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  if (/hexo-theme-next|\/css\/main\.css|\/lib\/jquery|adsbygoogle/i.test(html)) {
    failures.push(`${file}: 仍含 Hexo 主题引用`);
  }
}

const articlesPage = resolve('dist/articles/index.html');
if (!existsSync(articlesPage) || !readFileSync(articlesPage, 'utf8').includes(`共 ${counts.total} 篇`)) {
  failures.push('/articles/: 统一文章页数量不正确');
}
if (!readFileSync(articlesPage, 'utf8').includes('/search.json')) {
  failures.push('/articles/: 未接入全文搜索索引');
}
if (!readFileSync(articlesPage, 'utf8').includes('URLSearchParams(window.location.search)')) {
  failures.push('/articles/: 未支持 q 查询参数');
}

const searchIndex = resolve('dist/search.json');
if (!existsSync(searchIndex)) {
  failures.push('/search.json: 全文搜索索引未生成');
} else {
  const search = JSON.parse(readFileSync(searchIndex, 'utf8'));
  if (search.length !== counts.total) {
    failures.push(`/search.json: 搜索索引数量不正确，当前 ${search.length} 篇`);
  }
  if (!search.some((post) => `${post.title} ${post.description} ${post.tags?.join(' ')} ${post.text}`.includes('Chrome'))) {
    failures.push('/search.json: 搜索索引未包含预期正文关键词');
  }
}

const atomFeed = resolve('dist/atom.xml');
if (!existsSync(atomFeed) || !readFileSync(atomFeed, 'utf8').includes('<feed xmlns="http://www.w3.org/2005/Atom">')) {
  failures.push('/atom.xml: 旧订阅地址未生成有效 Atom Feed');
}

const openSearch = resolve('dist/opensearch.xml');
if (!existsSync(openSearch) || !readFileSync(openSearch, 'utf8').includes('/articles/?q={searchTerms}')) {
  failures.push('/opensearch.xml: OpenSearch 描述文件未生成或模板不正确');
}

const llmsText = resolve('dist/llms.txt');
if (!existsSync(llmsText) || !readFileSync(llmsText, 'utf8').includes(`## Articles (${counts.total})`)) {
  failures.push('/llms.txt: 机器可读站点说明未生成或文章数量不正确');
}

const humansText = resolve('dist/humans.txt');
if (!existsSync(humansText) || !readFileSync(humansText, 'utf8').includes('Built with Astro and GitHub Pages.')) {
  failures.push('/humans.txt: 人类可读站点说明未生成或内容不正确');
}

const publishedNewPostCount = counts.published;

const jsonFeed = resolve('dist/feed.json');
let latestPostPath = '';
let latestPostTitle = '';
if (!existsSync(jsonFeed)) {
  failures.push('/feed.json: JSON Feed 未生成');
} else {
  const feed = JSON.parse(readFileSync(jsonFeed, 'utf8'));
  if (feed.version !== 'https://jsonfeed.org/version/1.1') {
    failures.push('/feed.json: JSON Feed version 不正确');
  }
  if (!Array.isArray(feed.items) || feed.items.length !== publishedNewPostCount) {
    failures.push(`/feed.json: JSON Feed items 数量不正确，当前 ${Array.isArray(feed.items) ? feed.items.length : 0} 篇`);
  }
  latestPostTitle = feed.items?.[0]?.title || '';
  try {
    latestPostPath = decodeURIComponent(new URL(feed.items?.[0]?.url || '').pathname);
  } catch {
    latestPostPath = '';
  }
  if (!latestPostPath.startsWith('/posts/')) {
    failures.push('/feed.json: JSON Feed 最新文章地址不正确');
  }
}

const latestOg = latestPostPath ? resolve('dist/og', latestPostPath.slice(1), 'index.png') : '';
if (!latestOg || !existsSync(latestOg)) {
  failures.push(`${latestPostPath || '/posts/'}: 新文章分享图未生成`);
} else {
  const metadata = await sharp(latestOg).metadata();
  if (metadata.format !== 'png' || metadata.width !== 1200 || metadata.height !== 630) {
    failures.push(`${latestPostPath}: 分享图不是 1200×630 PNG`);
  }
}

const firstLegacyOg = resolve('dist', 'og', legacyPosts[0].href.slice(1), 'index.png');
if (!existsSync(firstLegacyOg)) {
  failures.push(`${legacyPosts[0].href}: 旧文章分享图未生成`);
}

const articleOgImages = walk(resolve('dist/og')).filter((path) => path.endsWith('index.png'));
if (articleOgImages.length !== counts.total) {
  failures.push(`/og/: 文章级 PNG 分享图数量不正确，当前 ${articleOgImages.length} 张`);
}

const latestPostPage = latestPostPath ? resolve('dist', latestPostPath.slice(1), 'index.html') : '';
if (!latestPostPage || !existsSync(latestPostPage)) {
  failures.push(`${latestPostPath || '/posts/'}: 最新文章页面未生成`);
} else {
  const latestPostHtml = readFileSync(latestPostPage, 'utf8');
  const expectedOgPath = `/og${latestPostPath}index.png`;
  if (!latestPostHtml.includes(expectedOgPath) && !latestPostHtml.includes(encodeURI(expectedOgPath))) {
    failures.push(`${latestPostPath}: 未引用文章级 Open Graph 分享图`);
  }
  if (latestPostTitle && !latestPostHtml.includes(`property="og:image:alt" content="${latestPostTitle}"`)) {
    failures.push(`${latestPostPath}: 分享图替代文本未使用文章标题`);
  }
  if (!latestPostHtml.includes('property="og:image:type" content="image/png"')) {
    failures.push(`${latestPostPath}: 分享图未声明 image/png 类型`);
  }
  if (!/[\d,]+ 字 · 约 \d+ 分钟/.test(latestPostHtml)) {
    failures.push(`${latestPostPath}: 未展示统一阅读字数和预计阅读时间`);
  }
}

const tagIndex = resolve('dist/tags/index.html');
const publicAccountTag = resolve('dist/tags/公众号归档/index.html');
if (!existsSync(tagIndex) || !readFileSync(tagIndex, 'utf8').includes('class="tag-cloud"')) {
  failures.push('/tags/: 标签索引未正确生成');
}
if (!existsSync(publicAccountTag) || !readFileSync(publicAccountTag, 'utf8').includes('公众号归档')) {
  failures.push('/tags/公众号归档/: 标签文章列表未正确生成');
}

const homePage = readFileSync(resolve('dist/index.html'), 'utf8');
if ((homePage.match(/class="meta"/g) ?? []).length < 8) {
  failures.push('/: 首页没有展示 8 篇最近文章');
}

const builtCSS = walk(resolve('dist'))
  .filter((file) => file.endsWith('.css'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');
if (!builtCSS.includes('@media print') || !builtCSS.includes('article-body a[href^=http]')) {
  failures.push('CSS: 打印友好样式未进入构建产物');
}

const firstLegacyPage = resolve('dist', legacyPosts[0].href.slice(1), 'index.html');
if (!readFileSync(firstLegacyPage, 'utf8').includes('aria-label="文章导航"')) {
  failures.push(`${legacyPosts[0].href}: 缺少上一篇/下一篇导航`);
}
if (!/[\d,]+ 字 · 约 \d+ 分钟/.test(readFileSync(firstLegacyPage, 'utf8'))) {
  failures.push(`${legacyPosts[0].href}: 缺少统一阅读字数和预计阅读时间`);
}

if (failures.length) {
  console.error('构建产物检查失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

const bytes = statSync(resolve('dist/index.html')).size;
console.log(`构建产物检查通过：70 篇旧文已统一渲染，首页 ${bytes} 字节`);
