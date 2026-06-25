import { getLegacyPosts, getNewPosts, getTags } from '../lib/posts';

export function GET(context: { site?: URL }) {
  const origin = context.site?.toString().replace(/\/$/, '') ?? 'http://localhost:4321';
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const contentPaths = [...getNewPosts(), ...getLegacyPosts()].map((post) => post.href);
  const tagPaths = getTags().map((tag) => `/tags/${encodeURIComponent(tag.name)}/`);
  const paths = ['/', '/about/', '/articles/', '/tags/', ...tagPaths, ...contentPaths];
  const urls = paths
    .map((path) => `  <url><loc>${new URL(`${base}${path}`, `${origin}/`).toString()}</loc></url>`)
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }
  );
}
