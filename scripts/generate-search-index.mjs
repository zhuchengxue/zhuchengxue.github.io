import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import matter from 'gray-matter';

const postsDirectory = resolve('src/content/posts');
const legacyPosts = JSON.parse(readFileSync(resolve('src/content/legacy-posts.json'), 'utf8'));
const outputPath = resolve('public/search.json');

function htmlToText(html) {
  return String(html ?? '')
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

function markdownToText(markdown) {
  return String(markdown ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const newPosts = readdirSync(postsDirectory)
  .filter((file) => file.endsWith('.md'))
  .map((file) => {
    const source = readFileSync(resolve(postsDirectory, file), 'utf8');
    const parsed = matter(source);
    return {
      title: parsed.data.title,
      description: parsed.data.description,
      href: `/posts/${basename(file, '.md')}/`,
      tags: parsed.data.tags ?? [],
      legacy: false,
      draft: parsed.data.draft,
      pubDate: new Date(parsed.data.pubDate).toISOString(),
      text: markdownToText(parsed.content).slice(0, 12000)
    };
  })
  .filter((post) => !post.draft);

const oldPosts = legacyPosts.map((post) => {
  const text = htmlToText(post.html);
  return {
    title: post.title,
    description: text.slice(0, 120),
    href: post.href,
    tags: post.tags,
    legacy: true,
    pubDate: new Date(post.pubDate).toISOString(),
    text: text.slice(0, 12000)
  };
});

const index = [...newPosts, ...oldPosts]
  .sort((a, b) => new Date(b.pubDate).valueOf() - new Date(a.pubDate).valueOf());

mkdirSync(resolve('public'), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(index)}\n`, 'utf8');

console.log(`全文搜索索引已生成：${index.length} 篇 -> ${outputPath}`);
