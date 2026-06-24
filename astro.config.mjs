import { defineConfig } from 'astro/config';

const [owner = '', repository = ''] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const isUserSite = repository.endsWith('.github.io');

export default defineConfig({
  site: owner ? `https://${owner}.github.io` : 'http://localhost:4321',
  base: repository && !isUserSite ? `/${repository}` : '/',
  output: 'static',
  trailingSlash: 'always'
});
