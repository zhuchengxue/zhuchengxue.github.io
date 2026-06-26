import { SITE } from '../config';
import { getNewPosts } from '../lib/posts';

export function GET(context: { site?: URL }) {
  const posts = getNewPosts();
  const origin = context.site?.toString().replace(/\/$/, '') ?? 'http://localhost:4321';
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const siteURL = `${origin}${base}/`;
  const feedURL = `${origin}${base}/feed.json`;

  return new Response(
    JSON.stringify({
      version: 'https://jsonfeed.org/version/1.1',
      title: SITE.title,
      description: SITE.description,
      home_page_url: siteURL,
      feed_url: feedURL,
      language: SITE.language,
      authors: [
        {
          name: SITE.author
        }
      ],
      items: posts.map((post) => {
        const url = `${origin}${base}${post.href}`;
        return {
          id: url,
          url,
          title: post.title,
          summary: post.description ?? '',
          date_published: post.pubDate.toISOString(),
          tags: post.tags
        };
      })
    }),
    {
      headers: {
        'Content-Type': 'application/feed+json; charset=utf-8'
      }
    }
  );
}
