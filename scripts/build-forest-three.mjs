/**
 * 专注森林：从完整的 three 构建产物里摇出 scene.js 实际用到的那部分。
 *
 * 导出清单不手写 —— 直接扫 scene.js 里的 `THREE.Xxx`,所以 scene.js 新用一个类,
 * 重跑本脚本(npm run build 会自动跑)即可。产物 vendor/three.forest.min.js 是生成文件，已 gitignore。
 * 完整构建(vendor/three.module.min.js + three.core.min.js)仍是版本锁定的源，升级 three 时换它们。
 */
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const DIR = 'public/tools/focus-forest';
// 先剥掉注释，免得注释里举例的类名混进导出清单
const source = (await readFile(`${DIR}/js/scene.js`, 'utf8'))
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const names = [...new Set([...source.matchAll(/\bTHREE\.([A-Za-z_]\w*)/g)].map((m) => m[1]))].sort();

const result = await build({
  stdin: {
    contents: `export { ${names.join(', ')} } from './three.module.min.js';`,
    resolveDir: `${DIR}/vendor`,
    sourcefile: 'three.forest.entry.js',
  },
  outfile: `${DIR}/vendor/three.forest.min.js`,
  bundle: true,
  format: 'esm',
  minify: true,
  treeShaking: true,
  target: ['es2020'],
  legalComments: 'none',
  banner: {
    js: '/** three.js r185 (MIT, Copyright 2010-2026 Three.js Authors), tree-shaken for focus-forest by scripts/build-forest-three.mjs. Do not edit. */',
  },
  metafile: true,
  logLevel: 'warning',
});

const bytes = Object.values(result.metafile.outputs)[0].bytes;
console.log(`focus-forest three: ${names.length} exports, ${(bytes / 1024).toFixed(0)} KB`);
