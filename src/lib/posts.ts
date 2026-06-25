import legacyPosts from '../content/legacy-posts.json';

export interface PostSummary {
  title: string;
  description?: string;
  pubDate: Date;
  href: string;
  tags: string[];
  legacy: boolean;
}

export function htmlToText(html: string) {
  return html
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

export function getNewPostContents() {
  const modules = import.meta.glob('../content/posts/*.md', { eager: true });

  return Object.entries(modules)
    .map(([path, post]: [string, any]) => {
      const rawContent = typeof post.rawContent === 'function' ? post.rawContent() : post.rawContent;
      return {
        title: post.frontmatter.title,
        description: post.frontmatter.description,
        pubDate: new Date(post.frontmatter.pubDate),
        href: `/posts/${path.split('/').pop()!.replace(/\.md$/, '')}/`,
        tags: post.frontmatter.tags ?? [],
        legacy: false,
        draft: post.frontmatter.draft,
        text: String(rawContent ?? '').replace(/^---[\s\S]*?---/, '').replace(/\s+/g, ' ').trim()
      };
    })
    .filter((post) => !post.draft)
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}

export function getLegacyPosts(): PostSummary[] {
  return legacyPosts
    .map((post) => ({
      title: post.title,
      description: htmlToText(post.html).slice(0, 120),
      pubDate: new Date(post.pubDate),
      href: post.href,
      tags: post.tags,
      legacy: true
    }))
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}

export function getLegacyPostContents() {
  return legacyPosts
    .map((post) => ({
      title: post.title,
      description: htmlToText(post.html).slice(0, 120),
      pubDate: new Date(post.pubDate),
      href: post.href,
      tags: post.tags,
      legacy: true,
      text: htmlToText(post.html)
    }))
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}

export function getAllPosts(): PostSummary[] {
  return [...getNewPosts(), ...getLegacyPosts()]
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}

export function getSearchIndex() {
  return [...getNewPostContents(), ...getLegacyPostContents()]
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf())
    .map((post) => ({
      title: post.title,
      description: post.description,
      href: post.href,
      tags: post.tags,
      legacy: post.legacy,
      pubDate: post.pubDate.toISOString(),
      text: post.text.slice(0, 12000)
    }));
}

export function getTags() {
  const counts = new Map<string, number>();
  for (const post of getAllPosts()) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}
