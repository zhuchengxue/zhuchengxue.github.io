import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const inputArg = args.find((arg) => arg !== '--dry-run') ?? 'imports/wechat';
const inputPath = resolve(inputArg);
const postsDirectory = resolve('src/content/posts');
const supportedExtensions = new Set(['.html', '.htm', '.txt', '.md']);

if (!existsSync(inputPath)) {
  console.error(`导入目录不存在：${inputPath}`);
  process.exit(1);
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

function decodeEntities(text) {
  return text
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function htmlToMarkdown(html) {
  return decodeEntities(
    html
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n\n')
      .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n\n')
      .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, content) =>
        `\n${stripTags(content).trim().split(/\r?\n/).map((line) => `> ${line.trim()}`).join('\n')}\n\n`
      )
      .replace(/<img[^>]*alt=["']?([^"'>]*)["']?[^>]*src=["']([^"']+)["'][^>]*>/gi, '\n![$1]($2)\n\n')
      .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, '\n![]($1)\n\n')
      .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
      .replace(/<\/?(ul|ol)[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/?strong[^>]*>/gi, '**')
      .replace(/<\/?b[^>]*>/gi, '**')
      .replace(/<\/?em[^>]*>/gi, '*')
      .replace(/<\/?i[^>]*>/gi, '*')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractTitle(source, fallback) {
  const titleMatch = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    ?? source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? decodeEntities(stripTags(titleMatch[1])).trim() : '';
  return title || fallback;
}

function slugify(name) {
  return name
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    || 'wechat-post';
}

function dateFromFilename(name) {
  return name.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? new Date().toISOString().slice(0, 10);
}

const files = readdirSync(inputPath)
  .filter((file) => supportedExtensions.has(extname(file).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, 'zh-CN'));

if (!files.length) {
  console.log('没有找到可导入文件。支持 .html、.htm、.txt、.md。');
  process.exit(0);
}

mkdirSync(postsDirectory, { recursive: true });

let imported = 0;
for (const file of files) {
  const sourcePath = join(inputPath, file);
  const extension = extname(file).toLowerCase();
  const raw = readFileSync(sourcePath, 'utf8');
  const sourceBase = basename(file, extension);
  const pubDate = dateFromFilename(sourceBase);
  const title = extension === '.md' ? sourceBase.replace(/^\d{4}-\d{2}-\d{2}-?/, '') : extractTitle(raw, sourceBase);
  const markdown = extension === '.html' || extension === '.htm' ? htmlToMarkdown(raw) : raw.trim();
  const slug = slugify(sourceBase.replace(/^\d{4}-\d{2}-\d{2}-?/, '') || title);
  const targetName = `${pubDate}-${slug}.md`;
  const targetPath = join(postsDirectory, targetName);

  if (existsSync(targetPath)) {
    console.log(`跳过已存在：${targetName}`);
    continue;
  }

  const output = `---\ntitle: ${JSON.stringify(title)}\ndescription: 待补充\npubDate: ${pubDate}\ntags:\n  - 旧公众号\ndraft: true\nwechatUrl:\ncover:\n---\n\n${markdown}\n`;

  imported++;
  if (dryRun) {
    console.log(`将导入：${file} -> ${targetName}`);
  } else {
    writeFileSync(targetPath, output, 'utf8');
    console.log(`已导入：${targetName}`);
  }
}

console.log(`${dryRun ? '预检' : '导入'}完成：${imported} 篇。`);
