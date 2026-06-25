import { SITE } from '../config';

export function GET() {
  return new Response(
    JSON.stringify({
      name: SITE.title,
      short_name: SITE.title,
      description: SITE.description,
      lang: SITE.language,
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: '#f8f7f2',
      theme_color: '#276749',
      icons: [
        {
          src: './favicon.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any'
        }
      ]
    }),
    {
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8'
      }
    }
  );
}
