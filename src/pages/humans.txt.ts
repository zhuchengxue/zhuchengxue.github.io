import { SITE } from '../config';

export function GET(context: { site?: URL }) {
  const origin = context.site?.toString().replace(/\/$/, '') ?? 'http://localhost:4321';
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const siteURL = `${origin}${base}`;

  const lines = [
    '/* TEAM */',
    `Author: ${SITE.author}`,
    `Site: ${siteURL}/`,
    `About: ${siteURL}/about/`,
    '',
    '/* THANKS */',
    'Built with Astro and GitHub Pages.',
    'Written from local Markdown files and designed as a long-term personal content base.',
    '',
    '/* SITE */',
    `Language: ${SITE.language}`,
    'Standards: HTML, CSS, RSS, Atom, JSON Feed, OpenSearch, sitemap.xml, robots.txt, llms.txt',
    `Last update: ${new Date().toISOString().slice(0, 10)}`,
    '',
    '/* CONTENT */',
    'New articles start in Markdown.',
    'Older posts are preserved with their original URLs when possible.',
    'WeChat distribution files are generated separately from the canonical blog source.'
  ];

  return new Response(`${lines.join('\n')}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
}
