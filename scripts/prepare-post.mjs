import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, extname, isAbsolute, relative, resolve } from 'node:path';
import sharp from 'sharp';

const postsDirectory = resolve('src/content/posts');
const inboxDirectory = resolve('public/images/inbox');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const articleArgument = args.find((arg) => arg !== '--dry-run');

if (!articleArgument) {
  if (process.env.npm_command === 'ci' || process.env.npm_command === 'install') {
    console.log('跳过 npm 安装阶段的 prepare 生命周期；整理文章请运行 npm run prepare -- "src/content/posts/文章.md"。');
    process.exit(0);
  }

  console.error('用法：npm run prepare -- "src/content/posts/文章.md" [--dry-run]');
  process.exit(1);
}

const articlePath = resolve(articleArgument);
const relativeArticle = relative(postsDirectory, articlePath);
if (relativeArticle.startsWith('..') || isAbsolute(relativeArticle) || !articlePath.endsWith('.md')) {
  console.error('只能整理 src/content/posts 下的 Markdown 文章。');
  process.exit(1);
}
if (!existsSync(articlePath)) {
  console.error(`文章不存在：${articlePath}`);
  process.exit(1);
}

const filename = basename(articlePath, '.md');
const articleSlug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, '');
const targetDirectory = resolve('public/images', articleSlug);
let source = readFileSync(articlePath, 'utf8');
const operations = [];
let sequence = 1;

const sanitizeAlt = (value) => value.trim() || '文章配图';
const imageName = (extension) =>
  `${articleSlug}-${String(sequence++).padStart(2, '0')}${extension}`;

function locateInboxFile(reference) {
  const decoded = decodeURIComponent(reference).replaceAll('\\', '/');
  const name = basename(decoded);
  const candidate = resolve(inboxDirectory, name);
  return candidate.startsWith(inboxDirectory) && existsSync(candidate) ? candidate : undefined;
}

function organizedReference(reference) {
  return reference.match(/(?:\.\.\/){2}images\/([^/]+)\/([^?#)]+)/);
}

async function planImage(reference, alt, originalMarkup) {
  if (/^(?:https?:|data:|\/)/i.test(reference)) return originalMarkup;

  const organized = organizedReference(reference);
  if (organized) {
    const path = resolve('public/images', organized[1], organized[2]);
    if (!existsSync(path)) throw new Error(`找不到图片：${reference}`);
    return originalMarkup;
  }

  const input = locateInboxFile(reference);
  if (!input) throw new Error(`附件不在 public/images/inbox：${reference}`);

  const extension = extname(input).toLowerCase();
  const outputExtension = extension === '.svg' ? '.svg' : '.webp';
  const outputName = imageName(outputExtension);
  const output = resolve(targetDirectory, outputName);
  const webPath = `../../images/${articleSlug}/${outputName}`;
  operations.push({ input, output, extension });
  return `![${sanitizeAlt(alt)}](${webPath})`;
}

const replacements = [];
for (const match of source.matchAll(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
  replacements.push({
    start: match.index,
    end: match.index + match[0].length,
    value: await planImage(match[1], match[2] ?? '', match[0])
  });
}
for (const match of source.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
  if (replacements.some((item) => match.index >= item.start && match.index < item.end)) continue;
  replacements.push({
    start: match.index,
    end: match.index + match[0].length,
    value: await planImage(match[2].trim(), match[1], match[0])
  });
}

for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
  source = `${source.slice(0, replacement.start)}${replacement.value}${source.slice(replacement.end)}`;
}

if (dryRun) {
  console.log(`文章：${articlePath}`);
  console.log(`待整理图片：${operations.length} 张`);
  operations.forEach(({ input, output }) => console.log(`- ${input} → ${output}`));
  process.exit(0);
}

mkdirSync(targetDirectory, { recursive: true });
for (const operation of operations) {
  if (operation.extension === '.svg') {
    writeFileSync(operation.output, readFileSync(operation.input));
  } else {
    await sharp(operation.input, { animated: true })
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toFile(operation.output);
  }
}

writeFileSync(articlePath, source, 'utf8');
for (const { input } of operations) rmSync(input, { force: true });

console.log(`文章图片整理完成：${operations.length} 张`);
console.log(`图片目录：${targetDirectory}`);
