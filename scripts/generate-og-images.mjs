import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import matter from 'gray-matter';

const fontCacheDirectory = resolve('.astro/fontconfig-cache');
mkdirSync(fontCacheDirectory, { recursive: true });
const fontHomeDirectory = resolve('.astro/font-home');
const fontLocalAppData = resolve(fontHomeDirectory, 'AppData/Local');
mkdirSync(resolve(fontHomeDirectory, '.cache/fontconfig'), { recursive: true });
mkdirSync(resolve(fontLocalAppData, 'fontconfig/cache'), { recursive: true });
process.env.HOME = fontHomeDirectory;
process.env.USERPROFILE = fontHomeDirectory;
process.env.LOCALAPPDATA = fontLocalAppData;
const fontConfigPath = resolve('.astro/fontconfig.xml');
const fontDirectories = process.platform === 'win32'
  ? [`${process.env.WINDIR || 'C:/Windows'}/Fonts`]
  : ['/usr/share/fonts', '/usr/local/share/fonts'];
const xmlPath = (value) => value.replaceAll('\\', '/').replaceAll('&', '&amp;');
writeFileSync(fontConfigPath, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
${fontDirectories.map((directory) => `  <dir>${xmlPath(directory)}</dir>`).join('\n')}
  <cachedir>${xmlPath(fontCacheDirectory)}</cachedir>
</fontconfig>
`, 'utf8');
process.env.FONTCONFIG_FILE = fontConfigPath;
const { default: sharp } = await import('sharp');

const legacyPosts = JSON.parse(readFileSync(resolve('src/content/legacy-posts.json'), 'utf8'));
const postsDirectory = resolve('src/content/posts');
const outputRoot = resolve('public/og');
const siteLabel = (() => {
  try {
    return new URL(process.env.SITE_URL || 'https://zhuchengxue.github.io').hostname;
  } catch {
    return 'zhuchengxue.github.io';
  }
})();

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function wrapText(value, maxLength, maxLines) {
  const source = String(value ?? '').replace(/\s+/g, ' ').trim();
  const lines = [];
  let line = '';

  for (const char of source) {
    const tentative = line + char;
    if ([...tentative].length > maxLength && line) {
      lines.push(line);
      line = char;
      if (lines.length === maxLines) break;
    } else {
      line = tentative;
    }
  }

  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && [...source].length > lines.join('').length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[，。,.、；;：:]?$/, '')}…`;
  }

  return lines;
}

function dateText(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function postOutputPath(href) {
  return resolve(outputRoot, href.replace(/^\/+/, ''), 'index.png');
}

function renderSVG(post) {
  const titleLines = wrapText(post.title, 20, 3);
  const descriptionLines = wrapText(post.description || '非学无以广才，非志无以成学。', 34, 2);
  const tags = (post.tags ?? []).slice(0, 4).join(' · ');
  const meta = [dateText(post.pubDate), tags].filter(Boolean).join(' · ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeHTML(post.title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7f4ea"/>
      <stop offset="55%" stop-color="#e9f2ea"/>
      <stop offset="100%" stop-color="#d7e8df"/>
    </linearGradient>
    <radialGradient id="halo" cx="80%" cy="15%" r="70%">
      <stop offset="0%" stop-color="#9ac2a8" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#9ac2a8" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#1c3b2d" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#halo)"/>
  <circle cx="1030" cy="120" r="150" fill="#276749" opacity="0.08"/>
  <circle cx="108" cy="532" r="210" fill="#d97706" opacity="0.08"/>
  <rect x="74" y="66" width="1052" height="498" rx="38" fill="#fffaf0" opacity="0.84" filter="url(#shadow)"/>
  <text x="116" y="130" fill="#276749" font-family="'Microsoft YaHei','PingFang SC','Noto Sans CJK SC',sans-serif" font-size="30" font-weight="700" letter-spacing="4">学语思</text>
  <text x="1084" y="130" text-anchor="end" fill="#61756a" font-family="'Microsoft YaHei','PingFang SC','Noto Sans CJK SC',sans-serif" font-size="24">${escapeHTML(meta)}</text>
  <g font-family="'Microsoft YaHei','PingFang SC','Noto Sans CJK SC',sans-serif" font-weight="800" font-size="64" fill="#16281f">
${titleLines.map((line, index) => `    <text x="116" y="${238 + index * 82}">${escapeHTML(line)}</text>`).join('\n')}
  </g>
  <g font-family="'Microsoft YaHei','PingFang SC','Noto Sans CJK SC',sans-serif" font-size="30" fill="#4e6258">
${descriptionLines.map((line, index) => `    <text x="118" y="${470 + index * 44}">${escapeHTML(line)}</text>`).join('\n')}
  </g>
  <line x1="116" y1="520" x2="1084" y2="520" stroke="#276749" stroke-opacity="0.16" stroke-width="2"/>
  <text x="116" y="556" fill="#276749" font-family="'Microsoft YaHei','PingFang SC','Noto Sans CJK SC',sans-serif" font-size="24">${escapeHTML(siteLabel)}</text>
</svg>
`;
}

function getNewPosts() {
  if (!existsSync(postsDirectory)) return [];

  return readdirSync(postsDirectory)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const parsed = matter(readFileSync(join(postsDirectory, file), 'utf8'));
      return {
        title: parsed.data.title,
        description: parsed.data.description,
        pubDate: parsed.data.pubDate,
        tags: parsed.data.tags ?? [],
        href: `/posts/${file.replace(/\.md$/, '')}/`,
        draft: parsed.data.draft
      };
    })
    .filter((post) => !post.draft);
}

const posts = [
  ...getNewPosts(),
  ...legacyPosts.map((post) => ({
    title: post.title,
    description: post.description,
    pubDate: post.pubDate,
    tags: post.tags,
    href: post.href
  }))
];

rmSync(outputRoot, { recursive: true, force: true });

for (let index = 0; index < posts.length; index += 6) {
  await Promise.all(posts.slice(index, index + 6).map(async (post) => {
    const outputPath = postOutputPath(post.href);
    mkdirSync(dirname(outputPath), { recursive: true });
    await sharp(Buffer.from(renderSVG(post)))
      .png({ compressionLevel: 9, palette: true, colours: 128 })
      .toFile(outputPath);
  }));
}

console.log(`OG 分享图已生成：${posts.length} 张压缩 PNG -> ${outputRoot}`);
