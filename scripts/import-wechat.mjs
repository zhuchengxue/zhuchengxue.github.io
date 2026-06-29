import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import matter from 'gray-matter';
import {
  extractArticleHtml,
  extractDescription,
  extractOriginalURL,
  extractPubDate,
  extractTitle,
  htmlToMarkdown
} from './lib/wechat-import.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const writeReport = args.includes('--report');
const inputArg = args.find((arg) => !arg.startsWith('--')) ?? 'imports/wechat';
const inputPath = resolve(inputArg);
const postsDirectory = resolve('src/content/posts');
const reportDirectory = resolve('exports');
const reportPath = resolve(reportDirectory, 'wechat-import-report.json');
const supportedExtensions = new Set(['.html', '.htm', '.txt', '.md']);

if (!existsSync(inputPath)) {
  console.error(`导入目录不存在：${inputPath}`);
  process.exit(1);
}

function slugify(name) {
  return name
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    || 'wechat-post';
}

function normalizeTitle(title) {
  return String(title || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function readExistingPosts() {
  if (!existsSync(postsDirectory)) return { files: new Set(), titles: new Set() };

  const files = new Set();
  const titles = new Set();
  for (const file of readdirSync(postsDirectory).filter((name) => name.endsWith('.md'))) {
    files.add(file);
    try {
      const parsed = matter(readFileSync(join(postsDirectory, file), 'utf8'));
      titles.add(normalizeTitle(parsed.data.title || basename(file, '.md')));
    } catch {
      titles.add(normalizeTitle(basename(file, '.md')));
    }
  }
  return { files, titles };
}

const files = readdirSync(inputPath)
  .filter((file) => supportedExtensions.has(extname(file).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, 'zh-CN'));

if (!files.length) {
  console.log('没有找到可导入文件。支持 .html、.htm、.txt、.md。');
  process.exit(0);
}

mkdirSync(postsDirectory, { recursive: true });

const existing = readExistingPosts();
const plannedTargets = new Set();
const report = [];

for (const file of files) {
  const sourcePath = join(inputPath, file);
  const extension = extname(file).toLowerCase();
  const raw = readFileSync(sourcePath, 'utf8');
  const sourceBase = basename(file, extension);
  const isHTML = extension === '.html' || extension === '.htm';
  const articleHtml = isHTML ? extractArticleHtml(raw) : raw;
  const pubDate = isHTML ? extractPubDate(raw, sourceBase) : extractPubDate('', sourceBase);
  const title = extension === '.md'
    ? sourceBase.replace(/^\d{4}-\d{2}-\d{2}-?/, '')
    : extractTitle(raw, sourceBase);
  const markdown = isHTML ? htmlToMarkdown(articleHtml) : raw.trim();
  const description = isHTML ? extractDescription(raw, articleHtml) : markdown.replace(/[#*_>`\[\]()!-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  const originalURL = isHTML ? extractOriginalURL(raw) : '';
  const slug = slugify(sourceBase.replace(/^\d{4}-\d{2}-\d{2}-?/, '') || title);
  const targetName = `${pubDate}-${slug}.md`;
  const targetPath = join(postsDirectory, targetName);
  const normalizedTitle = normalizeTitle(title);
  const reasons = [];

  if (existing.files.has(targetName) || existsSync(targetPath)) reasons.push('target-exists');
  if (plannedTargets.has(targetName)) reasons.push('duplicate-target-in-batch');
  if (existing.titles.has(normalizedTitle)) reasons.push('title-looks-duplicate');
  if (!markdown) reasons.push('empty-content');

  const status = reasons.includes('target-exists') || reasons.includes('duplicate-target-in-batch')
    ? 'skip'
    : reasons.length
      ? 'warn'
      : 'import';

  plannedTargets.add(targetName);
  report.push({
    source: file,
    target: targetName,
    title,
    pubDate,
    status,
    reasons,
    contentLength: markdown.length,
    imageCount: [...markdown.matchAll(/!\[[^\]]*\]\([^)]+\)/g)].length,
    originalURL
  });

  if (status === 'import' || status === 'warn') {
    const output = `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description || '待补充')}\npubDate: ${pubDate}\ntags:\n  - 旧公众号\ndraft: true\nwechatUrl: ${originalURL ? JSON.stringify(originalURL) : ''}\ncover:\n---\n\n${markdown}\n`;

    if (!dryRun) {
      writeFileSync(targetPath, output, 'utf8');
      existing.files.add(targetName);
      existing.titles.add(normalizedTitle);
    }
  }
}

const counts = report.reduce((accumulator, item) => {
  accumulator[item.status] = (accumulator[item.status] || 0) + 1;
  return accumulator;
}, {});

for (const item of report) {
  const marker = item.status === 'import' ? '将导入' : item.status === 'warn' ? '将导入（需复查）' : '跳过';
  const reasonText = item.reasons.length ? `；原因：${item.reasons.join(', ')}` : '';
  console.log(`${marker}：${item.source} -> ${item.target}${reasonText}`);
}

if (!dryRun || writeReport) {
  mkdirSync(reportDirectory, { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify({ dryRun, input: inputPath, counts, items: report }, null, 2)}\n`, 'utf8');
  console.log(`导入报告：${reportPath}`);
}

console.log(`${dryRun ? '预检' : '导入'}完成：${counts.import || 0} 篇可直接导入，${counts.warn || 0} 篇需复查，${counts.skip || 0} 篇跳过。`);
