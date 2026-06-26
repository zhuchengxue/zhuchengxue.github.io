const args = process.argv.slice(2);

function valueOf(name) {
  const flag = `--${name}`;
  const index = args.indexOf(flag);
  if (index === -1) return '';
  return args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1].trim() : '';
}

function enabled(name) {
  return args.includes(`--${name}`);
}

function printBlock(title, lines) {
  console.log(`\n## ${title}`);
  for (const line of lines) console.log(line);
}

const domain = valueOf('domain');
const giscusRepo = valueOf('giscus-repo');
const giscusRepoId = valueOf('giscus-repo-id');
const giscusCategory = valueOf('giscus-category');
const giscusCategoryId = valueOf('giscus-category-id');
const umamiScript = valueOf('umami-script');
const umamiWebsiteId = valueOf('umami-website-id');
const mirrorRepo = valueOf('mirror-repo');
const mirrorBranch = valueOf('mirror-branch') || (mirrorRepo ? 'pages' : '');
const mirrorDomain = valueOf('mirror-domain');
const includeWechat = enabled('wechat');

console.log('学语思外部服务配置助手');
console.log('这个脚本只生成配置清单，不保存 token，不修改 GitHub/Gitee/公众号后台。');

if (!domain && !giscusRepo && !umamiScript && !mirrorRepo && !includeWechat) {
  console.log('\n用法示例：');
  console.log('npm run config:services -- --domain example.com');
  console.log('npm run config:services -- --giscus-repo owner/repo --giscus-repo-id xxx --giscus-category General --giscus-category-id xxx');
  console.log('npm run config:services -- --umami-script https://analytics.example.com/script.js --umami-website-id xxx');
  console.log('npm run config:services -- --mirror-repo https://gitee.com/用户名/仓库名.git --mirror-branch pages --mirror-domain mirror.example.com');
  console.log('npm run config:services -- --wechat');
  process.exit(0);
}

const variables = [];

if (domain) {
  const siteURL = domain.startsWith('http') ? domain.replace(/\/$/, '') : `https://${domain}`;
  const customDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  variables.push(['SITE_URL', siteURL]);
  variables.push(['CUSTOM_DOMAIN', customDomain]);

  printBlock('独立域名', [
    `GitHub Pages Custom domain: ${customDomain}`,
    'DNS 建议：',
    `- CNAME: ${customDomain} -> zhuchengxue.github.io`,
    '- 或按 GitHub Pages 当前提示配置 A/AAAA 记录',
    '验证：npm run doctor -- --online'
  ]);
}

if (giscusRepo || giscusRepoId || giscusCategory || giscusCategoryId) {
  variables.push(['PUBLIC_GISCUS_REPO', giscusRepo]);
  variables.push(['PUBLIC_GISCUS_REPO_ID', giscusRepoId]);
  variables.push(['PUBLIC_GISCUS_CATEGORY', giscusCategory]);
  variables.push(['PUBLIC_GISCUS_CATEGORY_ID', giscusCategoryId]);

  printBlock('Giscus 评论', [
    'GitHub 仓库需要开启 Discussions，并在 https://giscus.app 生成四个公开变量。',
    '这些是 PUBLIC_ 变量，只会控制页面是否加载评论脚本，不要放私密 token。',
    '验证：推送后打开任意文章页，看底部是否出现评论框。'
  ]);
}

if (umamiScript || umamiWebsiteId) {
  variables.push(['PUBLIC_UMAMI_SCRIPT', umamiScript]);
  variables.push(['PUBLIC_UMAMI_WEBSITE_ID', umamiWebsiteId]);

  printBlock('Umami 访问统计', [
    '推荐使用自托管或可信托管的 Umami；默认不配置时页面不加载任何统计脚本。',
    '验证：推送后打开页面，检查浏览器网络请求或 Umami 后台实时访问。'
  ]);
}

if (mirrorRepo) {
  variables.push(['MIRROR_REPO', mirrorRepo]);
  variables.push(['MIRROR_BRANCH', mirrorBranch]);
  if (mirrorDomain) variables.push(['MIRROR_DOMAIN', mirrorDomain]);

  printBlock('国内或备用镜像', [
    '镜像同步默认仍是手动命令，不会在 GitHub Actions 自动运行。',
    `预检：MIRROR_REPO=${mirrorRepo} MIRROR_BRANCH=${mirrorBranch} npm run mirror -- --dry-run`,
    `正式：MIRROR_REPO=${mirrorRepo} MIRROR_BRANCH=${mirrorBranch}${mirrorDomain ? ` MIRROR_DOMAIN=${mirrorDomain}` : ''} npm run mirror`
  ]);
}

if (includeWechat) {
  printBlock('微信公众号草稿 API', [
    '需要在公众号后台确认 AppID/AppSecret、IP 白名单、草稿箱接口权限和封面素材 media_id。',
    '本地临时运行，不建议写入仓库：',
    'WECHAT_APP_ID=你的AppID WECHAT_APP_SECRET=你的AppSecret WECHAT_THUMB_MEDIA_ID=封面素材ID npm run wechat:draft -- exports/wechat/文章.json --dry-run'
  ]);
}

if (variables.length) {
  printBlock('GitHub Actions Variables 建议值', variables.map(([name, value]) => `${name}=${value}`));
  printBlock('配置位置', [
    'GitHub 仓库 → Settings → Secrets and variables → Actions → Variables',
    '配置后推送一次或手动运行 Deploy blog to GitHub Pages workflow。',
    '最终验收：npm run doctor -- --online'
  ]);
}
