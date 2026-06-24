export function GET(context: { site?: URL }) {
  const origin = context.site?.toString().replace(/\/$/, '') ?? 'http://localhost:4321';
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  return new Response(
    `User-agent: *
Allow: /

Sitemap: ${origin}${base}/sitemap.xml
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
}
