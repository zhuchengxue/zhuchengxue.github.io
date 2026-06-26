import { SITE } from '../config';

const escapeXml = (value = '') =>
  value.replace(/[<>&'"]/g, (char: string) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  })[char]!);

export function GET(context: { site?: URL }) {
  const origin = context.site?.toString().replace(/\/$/, '') ?? 'http://localhost:4321';
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>${escapeXml(SITE.title)}</ShortName>
  <Description>${escapeXml(`搜索 ${SITE.title} 的文章`)}</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Language>${escapeXml(SITE.language)}</Language>
  <Image height="16" width="16" type="image/svg+xml">${origin}${base}/favicon.svg</Image>
  <Url type="text/html" method="get" template="${origin}${base}/articles/?q={searchTerms}" />
</OpenSearchDescription>`,
    {
      headers: {
        'Content-Type': 'application/opensearchdescription+xml; charset=utf-8'
      }
    }
  );
}
