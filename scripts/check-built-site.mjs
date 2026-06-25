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

if (failures.length) {
  console.error('构建产物检查失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

const bytes = statSync(resolve('dist/index.html')).size;
console.log(`构建产物检查通过：70 篇旧文已统一渲染，首页 ${bytes} 字节`);
