import assert from 'node:assert/strict';
import {
  decodeEntities,
  extractArticleHtml,
  extractDescription,
  extractOriginalURL,
  extractPubDate,
  extractTitle,
  htmlToMarkdown
} from './lib/wechat-import.mjs';

const fixture = `<!doctype html>
<html>
<head>
  <meta property="og:title" content="测试 &amp; 标题">
  <meta property="article:published_time" content="2021-02-03T08:00:00+08:00">
  <meta property="og:url" content="https://mp.weixin.qq.com/s/test-article">
  <meta name="description" content="这是一篇用于验证迁移能力的公众号文章。">
  <title>不应优先使用的页面标题</title>
</head>
<body>
  <nav>页面导航不应进入正文</nav>
  <h1 id="activity-name">备用标题</h1>
  <div id="js_content" class="rich_media_content">
    <section><p>第一段正文。</p>
      <img class="rich_pages wxw-img" data-src="https://mmbiz.qpic.cn/example.jpg" alt="公众号配图">
      <p><a data-linktype="2" href="https://example.com/read">延伸阅读</a></p>
    </section>
  </div>
  <footer>页脚不应进入正文</footer>
</body>
</html>`;

const article = extractArticleHtml(fixture);
const markdown = htmlToMarkdown(article);

assert.equal(decodeEntities('A&amp;B &#x4E2D;&#25991;'), 'A&B 中文');
assert.equal(extractTitle(fixture, 'fallback'), '测试 & 标题');
assert.equal(extractPubDate(fixture, 'article'), '2021-02-03');
assert.equal(extractOriginalURL(fixture), 'https://mp.weixin.qq.com/s/test-article');
assert.equal(extractDescription(fixture, article), '这是一篇用于验证迁移能力的公众号文章。');
assert.match(markdown, /第一段正文/);
assert.match(markdown, /!\[公众号配图\]\(https:\/\/mmbiz\.qpic\.cn\/example\.jpg\)/);
assert.match(markdown, /\[延伸阅读\]\(https:\/\/example\.com\/read\)/);
assert.doesNotMatch(markdown, /页面导航|页脚不应进入正文/);

console.log('微信公众号导入转换测试通过：正文、data-src 图片、标题、日期、摘要和原文地址均已保留。');
