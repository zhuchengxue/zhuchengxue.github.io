const groups = [
  {
    name: '独立域名',
    variables: ['SITE_URL', 'CUSTOM_DOMAIN'],
    optional: true,
    note: '不配置时使用默认 GitHub Pages 域名。'
  },
  {
    name: 'Giscus 评论',
    variables: ['PUBLIC_GISCUS_REPO', 'PUBLIC_GISCUS_REPO_ID', 'PUBLIC_GISCUS_CATEGORY', 'PUBLIC_GISCUS_CATEGORY_ID'],
    optional: true,
    note: '必须四项同时配置；否则页面不会加载评论脚本。'
  },
  {
    name: 'Umami 访问统计',
    variables: ['PUBLIC_UMAMI_SCRIPT', 'PUBLIC_UMAMI_WEBSITE_ID'],
    optional: true,
    note: '必须两项同时配置；否则页面不会加载统计脚本。'
  },
  {
    name: '微信公众号草稿 API',
    variables: ['WECHAT_APP_ID', 'WECHAT_APP_SECRET'],
    optional: true,
    note: '只在本地创建微信草稿时需要；封面可自动上传，不要把凭据写入仓库。'
  },
  {
    name: '国内或备用镜像',
    variables: ['MIRROR_REPO', 'MIRROR_BRANCH'],
    optional: true,
    note: '只在手动运行 npm run mirror 时需要。'
  }
];

const strict = process.argv.includes('--strict');
const failures = [];
const warnings = [];

function stateOf(variable) {
  return process.env[variable]?.trim() ? '已配置' : '未配置';
}

console.log('外部服务配置检查');

for (const group of groups) {
  const configured = group.variables.filter((variable) => process.env[variable]?.trim());
  const complete = configured.length === group.variables.length;
  const empty = configured.length === 0;

  if (complete) {
    console.log(`✅ ${group.name}：已完整配置`);
  } else if (empty && group.optional) {
    console.log(`⬜ ${group.name}：未配置（可选）`);
  } else {
    const message = `${group.name}：只配置了 ${configured.length}/${group.variables.length} 项，可能不会生效`;
    if (strict) {
      failures.push(message);
      console.log(`❌ ${message}`);
    } else {
      warnings.push(message);
      console.log(`⚠️ ${message}`);
    }
  }

  for (const variable of group.variables) {
    console.log(`   - ${variable}: ${stateOf(variable)}`);
  }
  console.log(`   ${group.note}`);
}

if (warnings.length) {
  console.log('\n提醒：');
  warnings.forEach((warning) => console.log(`- ${warning}`));
  console.log('如需把半配置状态视为失败，运行：npm run services:check -- --strict');
}

if (failures.length) {
  console.error('\n外部服务配置检查失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('\n外部服务配置检查完成。');
