import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import matter from 'gray-matter';
import { findObsidianVault } from './lib/obsidian-vault.mjs';

const dryRun = process.argv.includes('--dry-run');
const vault = findObsidianVault();
const outputDirectory = process.env.NODE_ENV === 'test' && process.env.DROPBOX_IMPORT_OUTPUT
  ? resolve(process.env.DROPBOX_IMPORT_OUTPUT)
  : resolve('src/content/posts');

if (!vault) {
  console.error('没有找到 Obsidian Dropbox Vault。请先在 Obsidian 中打开写作库。');
  process.exit(1);
}

const sourceDirectories = [vault, resolve(vault, '已发布')].filter(existsSync);
const sourceFiles = sourceDirectories.flatMap((directory) => readdirSync(directory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
  .map((entry) => resolve(directory, entry.name)));

mkdirSync(outputDirectory, { recursive: true });
const existingFiles = readdirSync(outputDirectory).filter((file) => file.endsWith('.md'));
const existingTitles = new Set(existingFiles.map((file) => {
  try { return String(matter(readFileSync(resolve(outputDirectory, file), 'utf8')).data.title || '').trim(); }
  catch { return ''; }
}).filter(Boolean));

function cleanText(value) {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleAndBody(path) {
  const parsed = matter(readFileSync(path, 'utf8'));
  const source = parsed.content.replace(/!\[[^\]]*\]\(\s*\)/g, '');
  const h1 = source.match(/^\s*#\s+(.+?)\s*$/m);
  const title = cleanText(String(parsed.data.title || h1?.[1] || basename(path, '.md')));
  const body = h1 ? source.replace(h1[0], '').trim() : source.trim();
  return { title, body };
}

function descriptionFrom(body) {
  const paragraphs = body.split(/\r?\n\s*\r?\n/).map(cleanText).filter((text) => text.length >= 20);
  return (paragraphs[0] || '一篇来自公众号写作库的文章。').slice(0, 140);
}

function slugify(title) {
  return title.normalize('NFKC').toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'dropbox-article';
}

const imported = [];
const skipped = [];
for (const sourcePath of sourceFiles) {
  const { title, body } = titleAndBody(sourcePath);
  if (!title || existingTitles.has(title)) {
    skipped.push(`${basename(sourcePath)}（标题已存在）`);
    continue;
  }
  const pubDate = statSync(sourcePath).mtime.toISOString().slice(0, 10);
  let filename = `${pubDate}-${slugify(title)}.md`;
  let suffix = 2;
  while (existsSync(resolve(outputDirectory, filename))) {
    filename = `${pubDate}-${slugify(title)}-${suffix}.md`;
    suffix += 1;
  }
  const output = `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(descriptionFrom(body))}\npubDate: ${pubDate}\ntags:\n  - 公众号归档\ndraft: true\nwechatUrl:\ncover:\n---\n\n${body}\n`;
  imported.push(`${basename(sourcePath)} → ${filename}`);
  existingTitles.add(title);
  if (!dryRun) writeFileSync(resolve(outputDirectory, filename), output, 'utf8');
}

console.log(`Dropbox 文章：${sourceFiles.length} 篇`);
console.log(`${dryRun ? '可导入' : '已导入'}：${imported.length} 篇`);
for (const item of imported) console.log(`- ${item}`);
if (skipped.length) {
  console.log(`跳过：${skipped.length} 篇`);
  for (const item of skipped) console.log(`- ${item}`);
}
if (dryRun) console.log('预览完成；未写入博客草稿。');
