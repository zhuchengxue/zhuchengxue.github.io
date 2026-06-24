import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

export interface PostSummary {
  title: string;
  description?: string;
  pubDate: Date;
  href: string;
  tags: string[];
  legacy: boolean;
}

const PUBLIC_DIRECTORY = resolve('public');

export function getNewPosts(): PostSummary[] {
  const modules = import.meta.glob('../content/posts/*.md', { eager: true });

  return Object.entries(modules)
    .map(([path, post]: [string, any]) => ({
      title: post.frontmatter.title,
      description: post.frontmatter.description,
      pubDate: new Date(post.frontmatter.pubDate),
      href: `/posts/${path.split('/').pop()!.replace(/\.md$/, '')}/`,
      tags: post.frontmatter.tags ?? [],
      legacy: false,
      draft: post.frontmatter.draft
    }))
    .filter((post: PostSummary & { draft?: boolean }) => !post.draft)
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}

function readLegacyDirectory(directory: string): PostSummary[] {
  const posts: PostSummary[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      posts.push(...readLegacyDirectory(fullPath));
      continue;
    }

    if (entry.name !== 'index.html') continue;

    const relativePath = relative(PUBLIC_DIRECTORY, fullPath).split(sep).join('/');
    const match = relativePath.match(/^(\d{4})\/(\d{2})\/(\d{2})\/(.+)\/index\.html$/);
    if (!match) continue;

    const html = readFileSync(fullPath, 'utf8');
    const rawTitle = html.match(/<title>(.*?)<\/title>/s)?.[1]?.trim() ?? match[4];
    const title = rawTitle
      .replace(/\s*\|\s*学语思\s*$/, '')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>');

    posts.push({
      title,
      pubDate: new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00+08:00`),
      href: `/${relativePath.replace(/index\.html$/, '')}`,
      tags: [],
      legacy: true
    });
  }

  return posts;
}

export function getLegacyPosts(): PostSummary[] {
  return ['2017', '2018', '2020']
    .flatMap((year) => readLegacyDirectory(resolve(PUBLIC_DIRECTORY, year)))
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}

export function getAllPosts(): PostSummary[] {
  return [...getNewPosts(), ...getLegacyPosts()]
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}
