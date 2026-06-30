import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import matter from 'gray-matter';
import sharp from 'sharp';
import { cleanMarkdownText } from './dropbox-articles.mjs';

export function slugifyArticle(value) {
  return cleanMarkdownText(value).normalize('NFKC').toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'article';
}

function descriptionFrom(body) {
  const paragraphs = body.split(/\r?\n\s*\r?\n/)
    .map(cleanMarkdownText)
    .filter((text) => text.length >= 12);
  return (paragraphs[0] || '一篇来自个人写作库的文章。').slice(0, 140);
}

function existingPosts(postsDirectory) {
  if (!existsSync(postsDirectory)) return [];
  return readdirSync(postsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => {
      const path = resolve(postsDirectory, entry.name);
      try {
        return { path, filename: entry.name, parsed: matter(readFileSync(path, 'utf8')) };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function findExistingTarget(article, postsDirectory) {
  return existingPosts(postsDirectory).find((item) =>
    String(item.parsed.data.title || '').trim() === article.title);
}

function imageIndex(vaultPath) {
  const index = new Map();
  const pending = [vaultPath];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === '博客网站') continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (/\.(?:png|jpe?g|webp|gif|svg|avif)$/i.test(entry.name)) {
        const key = entry.name.toLocaleLowerCase('zh-CN');
        if (!index.has(key)) index.set(key, path);
      }
    }
  }
  return index;
}

function findImage(reference, article, vaultPath, indexedImages) {
  let decoded;
  try { decoded = decodeURIComponent(reference); } catch { decoded = reference; }
  const normalized = decoded.replaceAll('\\', '/').split('#')[0].trim();
  const candidates = [
    resolve(dirname(article.sourcePath), normalized),
    resolve(vaultPath, normalized),
    resolve(vaultPath, 'attachments', basename(normalized)),
    resolve(vaultPath, '附件', basename(normalized))
  ];
  return candidates.find((path) => existsSync(path) && statSync(path).isFile())
    || indexedImages.get(basename(normalized).toLocaleLowerCase('zh-CN'))
    || null;
}

function tagsFor(article, existing) {
  const tags = article.frontmatter.tags || existing?.parsed.data.tags;
  if (Array.isArray(tags) && tags.some((tag) => String(tag).trim())) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }
  return ['随笔'];
}

export async function transformDropboxArticle(article, options = {}) {
  const projectRoot = resolve(options.projectRoot || '.');
  const vaultPath = resolve(options.vaultPath);
  const postsDirectory = resolve(projectRoot, 'src/content/posts');
  const existing = findExistingTarget(article, postsDirectory);
  const existingDate = existing?.parsed.data.pubDate instanceof Date
    ? existing.parsed.data.pubDate.toISOString().slice(0, 10)
    : String(existing?.parsed.data.pubDate || '').slice(0, 10);
  const pubDate = /^\d{4}-\d{2}-\d{2}$/.test(existingDate) ? existingDate : article.pubDate;
  const slug = existing
    ? basename(existing.filename, '.md').replace(/^\d{4}-\d{2}-\d{2}-/, '')
    : slugifyArticle(article.title);
  const filename = existing?.filename || `${pubDate}-${slug}.md`;
  const targetPath = resolve(postsDirectory, filename);
  const imageDirectory = resolve(projectRoot, 'public/images', slug);
  const indexedImages = imageIndex(vaultPath);
  const imageOperations = [];
  let imageNumber = 0;

  async function rewriteImage(reference, alt, original) {
    if (/^(?:https?:|data:)/i.test(reference)) return original;
    const sourcePath = findImage(reference, article, vaultPath, indexedImages);
    if (!sourcePath) throw new Error(`找不到文章图片：${reference}`);
    imageNumber += 1;
    const extension = extname(sourcePath).toLowerCase() === '.svg' ? '.svg' : '.webp';
    const outputName = `${slug}-${String(imageNumber).padStart(2, '0')}${extension}`;
    imageOperations.push({ sourcePath, outputPath: resolve(imageDirectory, outputName), extension });
    return `![${cleanMarkdownText(alt) || '文章配图'}](../../images/${slug}/${outputName})`;
  }

  let body = article.body;
  const replacements = [];
  for (const match of body.matchAll(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
    replacements.push({
      start: match.index,
      end: match.index + match[0].length,
      value: await rewriteImage(match[1].trim(), match[2] || '', match[0])
    });
  }
  for (const match of body.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
    if (replacements.some((item) => match.index >= item.start && match.index < item.end)) continue;
    replacements.push({
      start: match.index,
      end: match.index + match[0].length,
      value: await rewriteImage(match[2].trim(), match[1], match[0])
    });
  }
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    body = `${body.slice(0, replacement.start)}${replacement.value}${body.slice(replacement.end)}`;
  }
  body = body.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, label) => label || target);

  const description = String(article.frontmatter.description || existing?.parsed.data.description || descriptionFrom(body)).trim();
  const tags = tagsFor(article, existing);
  const output = [
    '---',
    `title: ${JSON.stringify(article.title)}`,
    `description: ${JSON.stringify(description)}`,
    `pubDate: ${pubDate}`,
    'tags:',
    ...tags.map((tag) => `  - ${JSON.stringify(tag)}`),
    'draft: false',
    `wechatUrl: ${existing?.parsed.data.wechatUrl || ''}`,
    `cover: ${existing?.parsed.data.cover || ''}`,
    '---',
    '',
    body.trim(),
    ''
  ].join('\n');

  if (!options.dryRun) {
    mkdirSync(postsDirectory, { recursive: true });
    if (existsSync(imageDirectory)) rmSync(imageDirectory, { recursive: true, force: true });
    if (imageOperations.length) mkdirSync(imageDirectory, { recursive: true });
    for (const operation of imageOperations) {
      if (operation.extension === '.svg') {
        writeFileSync(operation.outputPath, readFileSync(operation.sourcePath));
      } else {
        await sharp(operation.sourcePath, { animated: true })
          .rotate()
          .resize({ width: 1600, withoutEnlargement: true })
          .webp({ quality: 82, effort: 3 })
          .toFile(operation.outputPath);
      }
    }
    writeFileSync(targetPath, output, 'utf8');
  }

  return {
    title: article.title,
    description,
    pubDate,
    tags,
    slug,
    filename,
    targetPath,
    relativeTarget: relative(projectRoot, targetPath).replaceAll('\\', '/'),
    imageDirectory,
    relativeImageDirectory: relative(projectRoot, imageDirectory).replaceAll('\\', '/'),
    imageCount: imageOperations.length,
    body,
    output,
    existed: Boolean(existing)
  };
}
