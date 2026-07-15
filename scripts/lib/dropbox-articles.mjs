import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import matter from 'gray-matter';
import { findObsidianVault } from './obsidian-vault.mjs';

export const DAILY_NOTE = '00-今日写作.md';
export const IDEAS_NOTE = '01-选题池.md';
export const PENDING_DIRECTORY = '02-待发布';
export const ARCHIVE_DIRECTORY = '03-已发布';
export const MATERIALS_DIRECTORY = '04-素材';
export const COLD_ARCHIVE_DIRECTORY = '05-归档';

const LEGACY_ARCHIVE_DIRECTORY = '已发布';
const INCLUDED_DIRECTORIES = [PENDING_DIRECTORY, ARCHIVE_DIRECTORY, LEGACY_ARCHIVE_DIRECTORY];
const IGNORED_ARTICLES = new Set(['写作风格.md', DAILY_NOTE, IDEAS_NOTE]);

export function cleanMarkdownText(value = '') {
  return String(value)
    .replace(/!\[\[[^\]]+\]\]/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, label) => label || target)
    .replace(/[*_~`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function readDropboxArticle(sourcePath, vaultPath) {
  const source = readFileSync(sourcePath, 'utf8');
  const parsed = matter(source);
  const h1 = parsed.content.match(/^\s*#\s+(.+?)\s*$/m);
  const title = cleanMarkdownText(parsed.data.title || h1?.[1] || basename(sourcePath, '.md'));
  const body = h1 ? parsed.content.replace(h1[0], '').trim() : parsed.content.trim();
  const relativePath = relative(vaultPath, sourcePath).replaceAll('\\', '/');
  const sourceId = relativePath
    .replace(new RegExp(`^(?:${PENDING_DIRECTORY}|${ARCHIVE_DIRECTORY}|${LEGACY_ARCHIVE_DIRECTORY})/`), '')
    .normalize('NFC');
  const modifiedDate = statSync(sourcePath).mtime.toISOString().slice(0, 10);
  const frontmatterDate = parsed.data.pubDate instanceof Date
    ? parsed.data.pubDate.toISOString().slice(0, 10)
    : String(parsed.data.pubDate || '').slice(0, 10);
  const filenameDate = basename(sourcePath).match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || '';

  return {
    id: relativePath,
    sourcePath,
    sourceId,
    relativePath,
    title,
    body,
    frontmatter: parsed.data,
    pubDate: /^\d{4}-\d{2}-\d{2}$/.test(frontmatterDate)
      ? frontmatterDate
      : filenameDate || modifiedDate,
    archived: relativePath.startsWith(`${ARCHIVE_DIRECTORY}/`) || relativePath.startsWith(`${LEGACY_ARCHIVE_DIRECTORY}/`),
    pending: relativePath.startsWith(`${PENDING_DIRECTORY}/`),
    modifiedAt: statSync(sourcePath).mtime.toISOString()
  };
}

export function ensureWritingStructure(vaultPath) {
  const resolvedVault = resolve(vaultPath);
  for (const directory of [PENDING_DIRECTORY, ARCHIVE_DIRECTORY, MATERIALS_DIRECTORY, COLD_ARCHIVE_DIRECTORY]) {
    mkdirSync(resolve(resolvedVault, directory), { recursive: true });
  }

  const dailyPath = resolve(resolvedVault, DAILY_NOTE);
  if (!existsSync(dailyPath)) {
    writeFileSync(dailyPath, [
      '# 今日写作',
      '',
      '先随便写，不急着变成文章。',
      '',
      '## 今天想写什么',
      '',
      '- ',
      '',
      '## 草稿',
      ''
    ].join('\n'), 'utf8');
  }

  const ideasPath = resolve(resolvedVault, IDEAS_NOTE);
  if (!existsSync(ideasPath)) {
    writeFileSync(ideasPath, [
      '# 选题池',
      '',
      '想到题目先丢在这里，不要求立刻写完。',
      '',
      '- '
    ].join('\n'), 'utf8');
  }

  return {
    vaultPath: resolvedVault,
    dailyPath,
    ideasPath,
    pendingDirectory: resolve(resolvedVault, PENDING_DIRECTORY),
    archiveDirectory: resolve(resolvedVault, ARCHIVE_DIRECTORY),
    materialsDirectory: resolve(resolvedVault, MATERIALS_DIRECTORY),
    coldArchiveDirectory: resolve(resolvedVault, COLD_ARCHIVE_DIRECTORY)
  };
}

export function listDropboxArticles(options = {}) {
  const candidate = options.vaultPath || findObsidianVault();
  if (!candidate || !existsSync(candidate)) {
    throw new Error('没有找到 Dropbox 写作库。请先在 Obsidian 中打开该库，或在设置中填写路径。');
  }
  const vaultPath = resolve(candidate);
  ensureWritingStructure(vaultPath);

  const scanned = INCLUDED_DIRECTORIES.flatMap((directory) => {
    const sourceDirectory = resolve(vaultPath, directory);
    if (!existsSync(sourceDirectory)) return [];
    return readdirSync(sourceDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      .filter((entry) => !IGNORED_ARTICLES.has(entry.name))
      .map((entry) => readDropboxArticle(resolve(sourceDirectory, entry.name), vaultPath));
  });

  const unique = new Map();
  for (const article of scanned) {
    const current = unique.get(article.sourceId);
    if (!current || (article.pending && !current.pending) || (!article.archived && current.archived) || article.modifiedAt > current.modifiedAt) {
      unique.set(article.sourceId, article);
    }
  }

  return {
    vaultPath,
    articles: [...unique.values()].sort((a, b) =>
      b.modifiedAt.localeCompare(a.modifiedAt) || a.title.localeCompare(b.title, 'zh-CN'))
  };
}

export function findDropboxArticle(id, options = {}) {
  const collection = listDropboxArticles(options);
  const article = collection.articles.find((item) => item.id === id);
  if (!article) throw new Error(`Dropbox 中找不到这篇文章：${id}`);
  return { ...collection, article };
}

export function archiveDropboxArticle(article, vaultPath) {
  if (article.archived) return { archived: true, path: article.sourcePath };
  const archiveDirectory = resolve(vaultPath, ARCHIVE_DIRECTORY);
  const destination = resolve(archiveDirectory, basename(article.sourcePath));
  mkdirSync(archiveDirectory, { recursive: true });
  if (existsSync(destination)) {
    if (readFileSync(article.sourcePath).equals(readFileSync(destination))) {
      rmSync(article.sourcePath, { force: true });
      return { archived: true, path: destination };
    }
    return { archived: false, warning: '“已发布”目录存在同名但内容不同的文件，请手动确认。' };
  }
  renameSync(article.sourcePath, destination);
  return { archived: true, path: destination };
}
