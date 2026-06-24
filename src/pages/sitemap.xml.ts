export function GET(context: { site?: URL }) {
  const modules = import.meta.glob('../content/posts/*.md', { eager: true });
  const slugs = Object.entries(modules)
    .filter(([, post]: [string, any]) => !post.frontmatter.draft)
    .map(([path]) => `/posts/${path.split('/').pop()!.replace(/\.md$/, '')}/`);
  const origin = context.site?.toString().replace(/\/$/, '') ?? 'http://localhost:4321';
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const paths = ['/', '/about/', ...slugs];
  const urls = paths
    .map((path) => `  <url><loc>${origin}${base}${path}</loc></url>`)
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }
  );
}
