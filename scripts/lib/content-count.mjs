import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import matter from 'gray-matter';

export function contentCounts() {
  const legacy = JSON.parse(readFileSync(resolve('src/content/legacy-posts.json'), 'utf8')).length;
  const markdown = readdirSync(resolve('src/content/posts'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => matter(readFileSync(resolve('src/content/posts', name), 'utf8')));
  const published = markdown.filter((post) => post.data.draft !== true).length;
  return { legacy, published, drafts: markdown.length - published, total: legacy + published };
}
