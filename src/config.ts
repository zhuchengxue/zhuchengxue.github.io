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

export const ADS = {
  enabled: import.meta.env.PUBLIC_ADS_ENABLED === 'true',
  provider: (import.meta.env.PUBLIC_AD_PROVIDER || 'adsense') as 'adsense' | 'custom',
  adsenseClient: import.meta.env.PUBLIC_ADSENSE_CLIENT as string | undefined,
  customHtml: import.meta.env.PUBLIC_AD_CUSTOM_HTML as string | undefined,
  slots: {
    articleBottom: import.meta.env.PUBLIC_ADSENSE_SLOT_ARTICLE_BOTTOM as string | undefined,
    listBottom: import.meta.env.PUBLIC_ADSENSE_SLOT_LIST_BOTTOM as string | undefined,
    tutorialTop: import.meta.env.PUBLIC_ADSENSE_SLOT_TUTORIAL_TOP as string | undefined,
    tutorialBottom: import.meta.env.PUBLIC_ADSENSE_SLOT_TUTORIAL_BOTTOM as string | undefined
  }
};
