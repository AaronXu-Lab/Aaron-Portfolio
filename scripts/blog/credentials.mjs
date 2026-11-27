import { randomBytes } from 'node:crypto';
import { rename, unlink, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { maxAccessKeyLength, minAccessKeyLength, passwordHash } from '../../workers/blog/auth.mjs';

async function readKey() {
  if (!process.stdin.isTTY) throw new Error('请在终端中运行此命令，以隐藏密钥输入。');

  const silentOutput = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const input = createInterface({ input: process.stdin, output: silentOutput, terminal: true });
  const ask = async (label) => {
    process.stderr.write(label);
    try { return await input.question(''); }
    finally { process.stderr.write('\n'); }
  };
  try {
    const size = `${minAccessKeyLength}–${maxAccessKeyLength} 个字符`;
    const key = await ask(`输入新的访问密钥（${size}）：`);
    if (key.length < minAccessKeyLength || key.length > maxAccessKeyLength)
      throw new Error(`访问密钥必须为 ${size}。`);
    if (await ask('再次输入访问密钥：') !== key) throw new Error('两次输入不一致，原密钥仍然有效。');
    return key;
  } finally {
    input.close();
  }
}

try {
  const key = await readKey();
  const salt = randomBytes(24).toString('hex');
  const hash = await passwordHash(key, salt);
  const file = new URL('../../.dev.vars.blog', import.meta.url);
  const temporaryFile = new URL('.dev.vars.blog.' + randomBytes(8).toString('hex'), file);
  await writeFile(temporaryFile, `BLOG_ACCESS_KEY_SALT=${salt}\nBLOG_ACCESS_KEY_HASH=${hash}\n`, { mode: 0o600, flag: 'wx' });
  try {
    await rename(temporaryFile, file);
  } catch (error) {
    await unlink(temporaryFile);
    throw error;
  }
  console.log('已保存密钥的加盐哈希。重启本地博客服务后即可使用新密钥。');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
