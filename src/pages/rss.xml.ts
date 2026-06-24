import { SITE } from '../config';

export async function GET(context: { site?: URL }) {
  const modules = import.meta.glob('../content/posts/*.md', { eager: true });
  const posts = Object.entries(modules)
    .map(([path, post]: [string, any]) => ({
      slug: path.split('/').pop()!.replace(/\.md$/, ''),
      ...post.frontmatter
    }))
    .filter((post) => !post.draft)
    .sort((a, b) => new Date(b.pubDate).valueOf() - new Date(a.pubDate).valueOf());

  const origin = context.site?.toString().replace(/\/$/, '') ?? 'http://localhost:4321';
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const escapeXml = (value = '') =>
    value.replace(/[<>&'"]/g, (char: string) => ({
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;'
    })[char]!);

  const items = posts.map((post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <description>${escapeXml(post.description ?? '')}</description>
      <link>${origin}${base}/posts/${post.slug}/</link>
      <guid>${origin}${base}/posts/${post.slug}/</guid>
      <pubDate>${new Date(post.pubDate).toUTCString()}</pubDate>
    </item>`).join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE.title)}</title>
    <description>${escapeXml(SITE.description)}</description>
    <link>${origin}${base}/</link>${items}
    <language>${SITE.language}</language>
    <atom:link href="${origin}${base}/rss.xml" rel="self" type="application/rss+xml" />
  </channel>
</rss>`,
    { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } }
  );
}
