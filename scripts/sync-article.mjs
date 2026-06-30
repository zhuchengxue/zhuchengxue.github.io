import { syncArticle } from './lib/sync-article.mjs';

const articleId = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
if (!articleId) {
  console.error('缺少 Dropbox 文章标识。请使用“发布文章”界面。');
  process.exit(1);
}

try {
  const result = await syncArticle({
    articleId,
    wechat: process.argv.includes('--wechat'),
    onProgress: (message) => console.log(message)
  });
  console.log(`博客：${result.articleUrl}`);
  if (result.wechatCreated) console.log('公众号：已进入草稿箱');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
