import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const legacyPosts = JSON.parse(readFileSync(resolve('src/content/legacy-posts.json'), 'utf8'));
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
if (!existsSync(articlesPage) || !readFileSync(articlesPage, 'utf8').includes('共 71 篇')) {
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
  if (search.length !== 71) {
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
if (!existsSync(llmsText) || !readFileSync(llmsText, 'utf8').includes('## Articles (71)')) {
  failures.push('/llms.txt: 机器可读站点说明未生成或文章数量不正确');
}

const humansText = resolve('dist/humans.txt');
if (!existsSync(humansText) || !readFileSync(humansText, 'utf8').includes('Built with Astro and GitHub Pages.')) {
  failures.push('/humans.txt: 人类可读站点说明未生成或内容不正确');
}

const publishedNewPostCount = readdirSync(resolve('src/content/posts'))
  .filter((name) => name.endsWith('.md'))
  .map((name) => readFileSync(resolve('src/content/posts', name), 'utf8'))
  .filter((content) => !/^draft:\s*true\s*$/m.test(content))
  .length;

const jsonFeed = resolve('dist/feed.json');
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
  if (!feed.items?.[0]?.url?.includes('/posts/2026-06-24-welcome/')) {
    failures.push('/feed.json: JSON Feed 未包含示例新文章');
  }
}

const welcomeOg = resolve('dist/og/posts/2026-06-24-welcome/index.svg');
if (!existsSync(welcomeOg) || !readFileSync(welcomeOg, 'utf8').includes('博客开始营业')) {
  failures.push('/og/posts/2026-06-24-welcome/index.svg: 新文章分享图未生成');
}

const firstLegacyOg = resolve('dist', 'og', legacyPosts[0].href.slice(1), 'index.svg');
if (!existsSync(firstLegacyOg) || !readFileSync(firstLegacyOg, 'utf8').includes(legacyPosts[0].title)) {
  failures.push(`${legacyPosts[0].href}: 旧文章分享图未生成`);
}

const welcomePage = resolve('dist/posts/2026-06-24-welcome/index.html');
if (!readFileSync(welcomePage, 'utf8').includes('/og/posts/2026-06-24-welcome/index.svg')) {
  failures.push('/posts/2026-06-24-welcome/: 未引用文章级 Open Graph 分享图');
}
if (!/[\d,]+ 字 · 约 \d+ 分钟/.test(readFileSync(welcomePage, 'utf8'))) {
  failures.push('/posts/2026-06-24-welcome/: 未展示统一阅读字数和预计阅读时间');
}

const tagIndex = resolve('dist/tags/index.html');
const blogTag = resolve('dist/tags/博客/index.html');
if (!existsSync(tagIndex) || !readFileSync(tagIndex, 'utf8').includes('class="tag-cloud"')) {
  failures.push('/tags/: 标签索引未正确生成');
}
if (!existsSync(blogTag) || !readFileSync(blogTag, 'utf8').includes('博客开始营业')) {
  failures.push('/tags/博客/: 标签文章列表未正确生成');
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
