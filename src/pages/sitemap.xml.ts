import { readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

function findLegacyPosts(directory: string): string[] {
  const paths: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      paths.push(...findLegacyPosts(fullPath));
    } else if (entry.name === 'index.html') {
      paths.push(`/${relative(resolve('public'), fullPath)
        .split(sep)
        .join('/')
        .replace(/index\.html$/, '')}`);
    }
  }

  return paths;
}

export function GET(context: { site?: URL }) {
  const modules = import.meta.glob('../content/posts/*.md', { eager: true });
  const slugs = Object.entries(modules)
    .filter(([, post]: [string, any]) => !post.frontmatter.draft)
    .map(([path]) => `/posts/${path.split('/').pop()!.replace(/\.md$/, '')}/`);
  const origin = context.site?.toString().replace(/\/$/, '') ?? 'http://localhost:4321';
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const legacyPaths = ['2017', '2018', '2020']
    .flatMap((year) => findLegacyPosts(resolve('public', year)));
  const paths = ['/', '/about/', '/archives/', ...slugs, ...legacyPaths];
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
