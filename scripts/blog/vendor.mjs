import { cp, mkdir } from 'node:fs/promises';

const source = new URL('../../node_modules/vditor/dist/', import.meta.url);
const target = new URL('../../public/vendor/vditor/dist/', import.meta.url);
for (const file of [
  'js/lute/lute.min.js',
  'js/i18n/zh_CN.js',
  'js/icons/ant.js',
  'js/highlight.js/styles/github.min.css',
  'js/highlight.js/styles/github-dark.min.css',
]) {
  await mkdir(new URL('.', new URL(file, target)), { recursive: true });
  await cp(new URL(file, source), new URL(file, target));
}
