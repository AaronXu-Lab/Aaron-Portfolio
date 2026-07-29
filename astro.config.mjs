import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.xuweinan.com',
  devToolbar: { enabled: false },
  // 「工具」页已升级为「产品」页;/tools/ 下的具体工具(flypy、travel-maps)路径不变
  redirects: { '/tools/': '/products/' },
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      defaultColor: false,
    },
  },
});
