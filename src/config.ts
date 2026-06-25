export const SITE = {
  title: '学语思',
  description: '非学无以广才，非志无以成学。',
  author: 'zhuchengxue',
  language: 'zh-CN',
  socialImage: '/og-default.png'
};

export const ANALYTICS = {
  umamiScript: import.meta.env.PUBLIC_UMAMI_SCRIPT as string | undefined,
  umamiWebsiteId: import.meta.env.PUBLIC_UMAMI_WEBSITE_ID as string | undefined
};

export const COMMENTS = {
  giscusRepo: import.meta.env.PUBLIC_GISCUS_REPO as string | undefined,
  giscusRepoId: import.meta.env.PUBLIC_GISCUS_REPO_ID as string | undefined,
  giscusCategory: import.meta.env.PUBLIC_GISCUS_CATEGORY as string | undefined,
  giscusCategoryId: import.meta.env.PUBLIC_GISCUS_CATEGORY_ID as string | undefined
};
