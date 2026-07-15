import legacyPosts from '../content/legacy-posts.json';

export interface PostSummary {
  title: string;
  description?: string;
  pubDate: Date;
  href: string;
  tags: string[];
  legacy: boolean;
  wordCount: number;
  readingMinutes: number;
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

export function getReadingStats(text = '') {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const cjkCount = normalized.match(/[\u3400-\u9fff\uf900-\ufaff]/g)?.length ?? 0;
  const latinWordCount = normalized
    .replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ')
    .match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
  const wordCount = cjkCount + latinWordCount;

  return {
    wordCount,
    readingMinutes: Math.max(1, Math.ceil(wordCount / 450))
  };
}

export function getNewPosts(): PostSummary[] {
  const modules = import.meta.glob('../content/posts/*.md', { eager: true });

  return Object.entries(modules)
    .map(([path, post]: [string, any]) => {
      const stats = getReadingStats(post.rawContent?.() ?? '');

      return {
        title: post.frontmatter.title,
        description: post.frontmatter.description,
        pubDate: new Date(post.frontmatter.pubDate),
        href: `/posts/${path.split('/').pop()!.replace(/\.md$/, '')}/`,
        tags: post.frontmatter.tags ?? [],
        legacy: false,
        draft: post.frontmatter.draft,
        ...stats
      };
    })
    .filter((post: PostSummary & { draft?: boolean }) => !post.draft)
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}

export function getLegacyPosts(): PostSummary[] {
  return legacyPosts
    .map((post) => {
      const text = htmlToText(post.html);

      return {
        title: post.title,
        description: text.slice(0, 120),
        pubDate: new Date(post.pubDate),
        href: post.href,
        tags: post.tags,
        legacy: true,
        ...getReadingStats(text)
      };
    })
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}

export function getAllPosts(): PostSummary[] {
  return [...getNewPosts(), ...getLegacyPosts()]
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}

export function isTutorialPost(post: PostSummary) {
  const searchable = [
    post.title,
    post.description ?? '',
    ...post.tags
  ].join(' ');

  return /教程|指南|攻略|方法|技巧|工作流/.test(searchable);
}

export function getTutorialPosts(): PostSummary[] {
  return getAllPosts().filter(isTutorialPost);
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
