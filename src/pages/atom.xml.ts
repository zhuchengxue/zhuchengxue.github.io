import { SITE } from '../config';
import { getNewPosts } from '../lib/posts';

const escapeXml = (value = '') =>
  value.replace(/[<>&'"]/g, (char: string) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  })[char]!);

export function GET(context: { site?: URL }) {
  const posts = getNewPosts();
  const origin = context.site?.toString().replace(/\/$/, '') ?? 'http://localhost:4321';
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const feedURL = `${origin}${base}/atom.xml`;
  const updated = posts[0]?.pubDate.toISOString() ?? new Date(0).toISOString();
  const entries = posts.map((post) => {
    const url = `${origin}${base}${post.href}`;
    return `
  <entry>
    <title>${escapeXml(post.title)}</title>
    <id>${url}</id>
    <link href="${url}" />
    <updated>${post.pubDate.toISOString()}</updated>
    <summary>${escapeXml(post.description ?? '')}</summary>
  </entry>`;
  }).join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(SITE.title)}</title>
  <subtitle>${escapeXml(SITE.description)}</subtitle>
  <id>${origin}${base}/</id>
  <link href="${origin}${base}/" />
  <link href="${feedURL}" rel="self" />
  <updated>${updated}</updated>
  <author><name>${escapeXml(SITE.author)}</name></author>${entries}
</feed>`,
    { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } }
  );
}
