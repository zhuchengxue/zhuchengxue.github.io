import { SITE } from '../config';
import { getAllPosts } from '../lib/posts';

export function GET(context: { site?: URL }) {
  const origin = context.site?.toString().replace(/\/$/, '') ?? 'http://localhost:4321';
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const siteURL = `${origin}${base}`;
  const posts = getAllPosts();

  const lines = [
    `# ${SITE.title}`,
    '',
    SITE.description,
    '',
    '## Site',
    `- Home: ${siteURL}/`,
    `- Articles: ${siteURL}/articles/`,
    `- Tutorials: ${siteURL}/tutorials/`,
    `- Tags: ${siteURL}/tags/`,
    `- About: ${siteURL}/about/`,
    '',
    '## Machine-readable indexes',
    `- Sitemap: ${siteURL}/sitemap.xml`,
    `- RSS: ${siteURL}/rss.xml`,
    `- Atom: ${siteURL}/atom.xml`,
    `- JSON Feed: ${siteURL}/feed.json`,
    `- Search index: ${siteURL}/search.json`,
    `- OpenSearch: ${siteURL}/opensearch.xml`,
    '',
    '## Content notes',
    '- This is a personal blog built as a static site.',
    '- Articles are rendered in a unified Astro layout.',
    '- Older posts keep their original URLs when possible.',
    '- New writing starts from Markdown and can be distributed to WeChat public account HTML.',
    '',
    `## Articles (${posts.length})`,
    ...posts.map((post) => `- ${post.title}: ${siteURL}${post.href}`)
  ];

  return new Response(`${lines.join('\n')}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
}
