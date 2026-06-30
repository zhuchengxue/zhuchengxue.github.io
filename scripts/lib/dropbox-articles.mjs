import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import matter from 'gray-matter';
import { findObsidianVault } from './obsidian-vault.mjs';

const INCLUDED_DIRECTORIES = ['', '已发布'];
const IGNORED_ARTICLES = new Set(['写作风格.md']);

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
  const sourceId = relativePath.replace(/^已发布\//, '').normalize('NFC');
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
    archived: relativePath.startsWith('已发布/'),
    modifiedAt: statSync(sourcePath).mtime.toISOString()
  };
}

export function listDropboxArticles(options = {}) {
  const candidate = options.vaultPath || findObsidianVault();
  if (!candidate || !existsSync(candidate)) {
    throw new Error('没有找到 Dropbox 写作库。请先在 Obsidian 中打开该库，或在设置中填写路径。');
  }
  const vaultPath = resolve(candidate);

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
    if (!current || (!article.archived && current.archived) || article.modifiedAt > current.modifiedAt) {
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
