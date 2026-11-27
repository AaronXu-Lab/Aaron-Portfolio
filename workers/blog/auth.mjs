export const minAccessKeyLength = 8;
export const maxAccessKeyLength = 20;

const encoder = new TextEncoder();
const cookieName = "__Secure-aaron-blog";
const maxJSON = 512 * 1024;
const json = (value, status = 200, headers = {}) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
class HTTPError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HTTPError(status, message);
};
const hex = (buffer) =>
  Array.from(new Uint8Array(buffer), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
export const hash = async (value) =>
  hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
export async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: encoder.encode(salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      key,
      256,
    ),
  );
}
function equal(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function bytes(request, max) {
  if (Number(request.headers.get("content-length")) > max)
    fail(413, "文件或正文过大。");
  const reader = request.body?.getReader();
  if (!reader) fail(400, "请求缺少内容。");
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      fail(413, "文件或正文过大。");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
async function body(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    fail(415, "请使用 JSON。");
  try {
    const value = JSON.parse(
      new TextDecoder().decode(await bytes(request, maxJSON)),
    );
    if (!value || typeof value !== "object" || Array.isArray(value))
      fail(400, "请使用 JSON 对象。");
    return value;
  } catch (e) {
    if (e instanceof HTTPError) throw e;
    fail(400, "请求内容无效。");
  }
}
const keyConfigured = (env) => env.BLOG_ACCESS_KEY_HASH && env.BLOG_ACCESS_KEY_SALT;
const keyVersion = (env) => hash(env.BLOG_ACCESS_KEY_HASH + env.BLOG_ACCESS_KEY_SALT);

async function session(request, env) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !keyConfigured(env))
    return null;
  const tokenHash = await hash(token),
    version = await keyVersion(env);
  const row = await env.BLOG_DB.prepare(
    "SELECT token_hash FROM sessions WHERE token_hash=? AND expires_at>? AND credential_version=?",
  )
    .bind(tokenHash, Date.now(), version)
    .first();
  return row ? tokenHash : null;
}
const cookie = (value, maxAge) =>
  `${cookieName}=${value}; Path=/api/blog/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
async function login(request, env) {
  if (!keyConfigured(env)) fail(503, "后台访问密钥尚未配置。");
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const now = Date.now(),
    key = await hash(ip);
  const count = await env.BLOG_DB.prepare(
    "INSERT INTO login_attempts(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING attempts",
  )
    .bind(key, now + 900000, now, now)
    .first();
  if (count.attempts > 10)
    fail(429, "尝试次数过多，请在 15 分钟后重试。");
  const input = await body(request);
  const accessKey = input.accessKey;
  if (
    typeof accessKey !== "string" ||
    accessKey.length < minAccessKeyLength ||
    accessKey.length > maxAccessKeyLength
  )
    fail(401, "访问密钥不正确。");
  const digest = await passwordHash(accessKey, env.BLOG_ACCESS_KEY_SALT);
  if (!equal(digest, env.BLOG_ACCESS_KEY_HASH)) fail(401, "访问密钥不正确。");
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.BLOG_DB.batch([
    env.BLOG_DB.prepare("DELETE FROM sessions WHERE expires_at<=?").bind(now),
    env.BLOG_DB.prepare(
      "DELETE FROM login_attempts WHERE key=? OR expires_at<=?",
    ).bind(key, now),
    env.BLOG_DB.prepare("INSERT INTO sessions VALUES(?,?,?)").bind(
      await hash(token),
      now + 43200000,
      await keyVersion(env),
    ),
  ]);
  return json({ authenticated: true }, 200, {
    "Set-Cookie": cookie(token, 43200),
  });
}

export { HTTPError, fail, json, bytes, body, session, login, cookie };
