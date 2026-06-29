function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function decodeEntities(text = '') {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    hellip: '…',
    ldquo: '“',
    lsquo: '‘',
    lt: '<',
    mdash: '—',
    middot: '·',
    nbsp: ' ',
    ndash: '–',
    quot: '"',
    rdquo: '”',
    rsquo: '’'
  };

  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (/^#x/i.test(entity)) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named[entity.toLowerCase()] ?? match;
  });
}

export function stripTags(html = '') {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
}

export function getAttribute(tag, name) {
  const attribute = escapeRegExp(name);
  const quoted = tag.match(new RegExp(`\\b${attribute}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  if (quoted) return decodeEntities(quoted[2].trim());
  return decodeEntities(tag.match(new RegExp(`\\b${attribute}\\s*=\\s*([^\\s>]+)`, 'i'))?.[1]?.trim() ?? '');
}

function extractBalancedElement(source, openingMatch) {
  const tagName = openingMatch[1];
  const contentStart = openingMatch.index + openingMatch[0].length;
  const tagPattern = new RegExp(`<\\/?${escapeRegExp(tagName)}\\b[^>]*>`, 'gi');
  tagPattern.lastIndex = contentStart;
  let depth = 1;

  for (const match of source.matchAll(tagPattern)) {
    if (match[0].startsWith('</')) depth -= 1;
    else if (!match[0].endsWith('/>')) depth += 1;
    if (depth === 0) return source.slice(contentStart, match.index);
  }

  return source.slice(contentStart);
}

function extractElementByAttribute(source, name, value, contains = false) {
  for (const match of source.matchAll(/<([a-z][\w:-]*)\b[^>]*>/gi)) {
    const attribute = getAttribute(match[0], name);
    const matched = contains
      ? attribute.split(/\s+/).includes(value)
      : attribute === value;
    if (matched) return extractBalancedElement(source, match);
  }
  return '';
}

function extractFirstElement(source, tagName) {
  const match = new RegExp(`<(${escapeRegExp(tagName)})\\b[^>]*>`, 'i').exec(source);
  return match ? extractBalancedElement(source, match) : '';
}

function extractMeta(source, names) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  for (const tag of source.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (getAttribute(tag[0], 'property') || getAttribute(tag[0], 'name') || getAttribute(tag[0], 'itemprop')).toLowerCase();
    if (wanted.has(key)) return getAttribute(tag[0], 'content');
  }
  return '';
}

export function extractArticleHtml(source) {
  return extractElementByAttribute(source, 'id', 'js_content')
    || extractElementByAttribute(source, 'class', 'rich_media_content', true)
    || extractFirstElement(source, 'article')
    || extractFirstElement(source, 'body')
    || source;
}

export function extractTitle(source, fallback = '') {
  const richTitle = extractElementByAttribute(source, 'id', 'activity-name')
    || extractElementByAttribute(source, 'class', 'rich_media_title', true);
  const titleElement = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const heading = source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '';
  const value = extractMeta(source, ['og:title', 'twitter:title']) || richTitle || titleElement || heading;
  return decodeEntities(stripTags(value)).replace(/\s+/g, ' ').trim() || fallback;
}

function normalizeDate(value) {
  const match = String(value).match(/((?:19|20)\d{2})[年\/.\-](\d{1,2})[月\/.\-](\d{1,2})/);
  if (!match) return '';
  const date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  return Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? '' : date;
}

export function extractPubDate(source, filename = '') {
  const fromFilename = normalizeDate(filename);
  if (fromFilename) return fromFilename;

  const metadata = extractMeta(source, ['article:published_time', 'publishdate', 'date', 'pubdate']);
  const displayed = extractElementByAttribute(source, 'id', 'publish_time')
    || source.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i)?.[1]
    || '';
  const fromPage = normalizeDate(metadata) || normalizeDate(decodeEntities(stripTags(displayed)));
  if (fromPage) return fromPage;

  const unix = source.match(/(?:publish_time|\bct)\s*[:=]\s*["']?(\d{10})/i)?.[1];
  if (unix) return new Date(Number(unix) * 1000).toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

export function extractOriginalURL(source) {
  const metaURL = extractMeta(source, ['og:url']);
  if (metaURL) return metaURL;
  for (const tag of source.matchAll(/<link\b[^>]*>/gi)) {
    if (getAttribute(tag[0], 'rel').toLowerCase() === 'canonical') return getAttribute(tag[0], 'href');
  }
  return source.match(/https:\/\/mp\.weixin\.qq\.com\/s\/[\w?=&%.-]+/i)?.[0] ?? '';
}

export function extractDescription(source, articleHtml = extractArticleHtml(source)) {
  const metadata = extractMeta(source, ['description', 'og:description']);
  const text = metadata || decodeEntities(stripTags(articleHtml)).replace(/\s+/g, ' ').trim();
  return text.slice(0, 120);
}

export function htmlToMarkdown(html) {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, '');

  return decodeEntities(
    cleaned
      .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_match, content) => `\n\`\`\`\n${decodeEntities(stripTags(content)).trim()}\n\`\`\`\n\n`)
      .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level, content) => `\n${'#'.repeat(Number(level))} ${stripTags(content).trim()}\n\n`)
      .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, content) =>
        `\n${decodeEntities(stripTags(content)).trim().split(/\r?\n/).filter(Boolean).map((line) => `> ${line.trim()}`).join('\n')}\n\n`
      )
      .replace(/<img\b[^>]*>/gi, (tag) => {
        const source = getAttribute(tag, 'data-src') || getAttribute(tag, 'data-original') || getAttribute(tag, 'src');
        if (!source || /^data:image\/(?:gif|png);base64,R0lGODlhAQABA/i.test(source)) return '';
        const alt = getAttribute(tag, 'alt').replace(/[\[\]]/g, '').trim();
        return `\n![${alt}](${source})\n\n`;
      })
      .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (tag) => {
        const href = getAttribute(tag.match(/^<a\b[^>]*>/i)?.[0] ?? '', 'href');
        const label = stripTags(tag).trim();
        return href ? `[${label || href}](${href})` : label;
      })
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
      .replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|section|figure|figcaption)>/gi, '\n\n')
      .replace(/<(?:p|div|section|figure|figcaption)\b[^>]*>/gi, '')
      .replace(/<\/?strong[^>]*>/gi, '**')
      .replace(/<\/?b[^>]*>/gi, '**')
      .replace(/<\/?em[^>]*>/gi, '*')
      .replace(/<\/?i[^>]*>/gi, '*')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
