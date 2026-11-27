import { body, bytes, cookie, fail, HTTPError, json, login, session } from './auth.mjs';
import { byDate, escape, filtersHTML, formatDate, listHTML, markdown, neighborsHTML, publicPost, recentHTML, replace, slug } from './content.mjs';

const apiPrefix = '/api/blog/';
const template = '/blog/__online-template/';
const catalog = '/blog/catalog.json';
const reservedSlugs = new Set(['admin', '__online-template', 'catalog.json']);
const maxImage = 5 * 1024 * 1024;
const fields = 'id, slug, title, body, category, tags, status, published_at, updated_at, revision';

function asset(request, env, path) {
  return env.ASSETS.fetch(new Request(new URL(path, request.url)));
}

function html(response, hooks) {
  const headers = new Headers(response.headers);
  for (const key of ['content-length', 'etag', 'last-modified', 'cache-control', 'content-encoding']) {
    headers.delete(key);
  }
  headers.set('Cache-Control', 'no-store');
  const rewriter = new HTMLRewriter();
  for (const [selector, handler] of hooks) rewriter.on(selector, handler);
  return rewriter.transform(new Response(response.body, { status: response.status, headers }));
}

async function staticCatalog(request, env) {
  const result = await asset(request, env, catalog);
  if (!result.ok) throw new Error('Blog catalog unavailable');
  return result.json();
}

function postData(input) {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  const category = typeof input.category === 'string' ? input.category.trim() : '';
  const tags = Array.isArray(input.tags) ? [...new Set(input.tags.map((tag) => typeof tag === 'string' ? tag.trim() : '').filter(Boolean))] : [];
  const status = input.status;
  if (!title || title.length > 160) fail(400, '请输入标题，最多 160 字。');
  if (body.length > 120000) fail(400, '正文最多 120,000 字。');
  if (!['draft', 'published'].includes(status)) fail(400, '请选择有效的文章状态。');
  if (status === 'published' && !body) fail(400, '发布前请填写正文。');
  if (category.length > 40 || category.includes('|') || tags.length > 15 || tags.some((tag) => tag.length > 40)) {
    fail(400, '分类最多 40 字，标签最多 15 个，每个最多 40 字。分类不能包含竖线。');
  }
  return { title, body, category, tags: JSON.stringify(tags), status };
}

async function savePost(request, env, id) {
  const input = await body(request);
  const post = publicPost(postData(input));
  const now = new Date().toISOString();
  const db = env.BLOG_DB;
  const existing = id && await db.prepare('SELECT status, published_at FROM posts WHERE id=?').bind(id).first();
  if (id && !existing) fail(404, '文章不存在。');
  if (existing?.status === 'published' && post.status === 'draft') fail(409, '已发布文章只能更新或删除。');
  const publishedAt = existing?.published_at ?? (post.status === 'published' ? now : null);
  if (existing) {
    const result = await db.prepare(`UPDATE posts SET title=?, body=?, category=?, tags=?, status=?,
      published_at=?, updated_at=?, summary=?, minutes=?, revision=revision+1 WHERE id=? AND revision=? RETURNING ${fields}`)
      .bind(post.title, post.body, post.category, post.tags, post.status, publishedAt, now, post.summary, post.minutes, id, Number(input.revision) || 0).first();
    if (!result) fail(409, '文章已在其他窗口更新。请先复制未保存的内容，再重新打开文章。');
    return json(result);
  }

  const newId = crypto.randomUUID();
  const base = Array.from(slug(post.title).replace(/[^\p{L}\p{N}_-]/gu, '')).slice(0, 72).join('') || 'post';
  const used = new Set((await staticCatalog(request, env)).map((p) => p.slug));
  for (let suffix = 0; suffix < 50; suffix++) {
    const candidate = suffix ? base + '-' + (suffix + 1) : base;
    if (used.has(candidate) || reservedSlugs.has(candidate)) continue;
    const result = await db.prepare(`INSERT INTO posts(id, slug, title, body, category, tags, status, published_at, updated_at, summary, minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(slug) DO NOTHING RETURNING ${fields}`)
      .bind(newId, candidate, post.title, post.body, post.category, post.tags, post.status, publishedAt, now, post.summary, post.minutes).first();
    if (result) return json(result, 201);
  }
  fail(409, '已有多篇同名文章，请调整标题。');
}

function imageFormat(data) {
  if (data.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => data[i] === byte)) return 'png';
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return 'jpeg';
  if (data.length >= 12 && String.fromCharCode(...data.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...data.slice(8, 12)) === 'WEBP') return 'webp';
}

async function media(request, env, path) {
  if (!env.BLOG_MEDIA) fail(503, '图片存储尚未配置。');
  if (request.method === 'POST') {
    const data = await bytes(request, maxImage);
    const format = imageFormat(data);
    if (!format || request.headers.get('Content-Type') !== 'image/' + format) fail(415, '请上传 JPEG、PNG 或 WebP 图片。');
    const key = crypto.randomUUID() + '.' + format;
    await env.BLOG_MEDIA.put(key, data, { httpMetadata: { contentType: 'image/' + format } });
    return json({ url: apiPrefix + 'media/' + key }, 201);
  }

  const key = path.slice('media/'.length);
  if (!/^[a-f0-9-]{36}\.(jpeg|png|webp)$/.test(key)) fail(404, '图片不存在。');
  const object = request.method === 'HEAD' ? await env.BLOG_MEDIA.head(key) : await env.BLOG_MEDIA.get(key);
  if (!object) fail(404, '图片不存在。');
  const headers = new Headers({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=31536000, immutable' });
  object.writeHttpMetadata(headers);
  return new Response(request.method === 'HEAD' ? null : object.body, { headers });
}

async function api(request, env, url) {
  const path = url.pathname.slice(apiPrefix.length);
  const method = request.method;
  if (['GET', 'HEAD'].includes(method) && path.startsWith('media/')) return media(request, env, path);
  if (!['GET', 'HEAD'].includes(method) && request.headers.get('Origin') !== url.origin) fail(403, '请求来源不受支持。');
  if (!env.BLOG_DB) fail(503, '博客后台尚未配置。');
  if (path === 'login' && method === 'POST') return login(request, env);

  const token = await session(request, env);
  if (!token) fail(401, '请登录后台。');
  if (path === 'session' && method === 'GET') return json({ authenticated: true });
  if (path === 'logout' && method === 'POST') {
    await env.BLOG_DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(token).run();
    return json({}, 200, { 'Set-Cookie': cookie('', 0) });
  }
  if (path === 'media' && method === 'POST') return media(request, env, path);
  if (path === 'posts' && method === 'POST') return savePost(request, env);
  if (path === 'posts' && method === 'GET') {
    const { results } = await env.BLOG_DB.prepare('SELECT id, slug, title, status, updated_at FROM posts ORDER BY updated_at DESC').all();
    return json(results);
  }
  const id = /^posts\/([a-f0-9-]{36})$/.exec(path)?.[1];
  if (id && method === 'PUT') return savePost(request, env, id);
  if (id && method === 'DELETE') {
    const { revision } = await body(request);
    if (!Number.isSafeInteger(revision) || revision < 1) fail(400, '缺少有效的文章版本。');
    const db = env.BLOG_DB;
    const deleted = await db.prepare('DELETE FROM posts WHERE id=? AND revision=? RETURNING id')
      .bind(id, revision).first();
    if (deleted) return json({ deleted: true });
    const exists = await db.prepare('SELECT 1 AS found FROM posts WHERE id=?').bind(id).first();
    if (exists) fail(409, '文章已在其他窗口更新。请重新打开文章后再删除。');
    fail(404, '文章不存在。');
  }
  if (id && method === 'GET') {
    const post = await env.BLOG_DB.prepare(`SELECT ${fields} FROM posts WHERE id=?`).bind(id).first();
    if (!post) fail(404, '文章不存在。');
    return json(post);
  }
  fail(404, '接口不存在。');
}

async function publicPage(request, env, url, path) {
  const match = /^\/blog\/([^/]+)\/$/.exec(path);
  const isList = path === '/blog/';
  const isHome = path === '/';
  if (path === template || path === template.slice(0, -1)) return new Response('Not found', { status: 404 });
  if ((!match && !isList && !isHome) || path === '/blog/admin/' || !env.BLOG_DB ||
      !['GET', 'HEAD'].includes(request.method)) return env.ASSETS.fetch(request);

  let slug;
  if (match) {
    try { slug = decodeURIComponent(match[1]); }
    catch { return new Response('Not found', { status: 404 }); }
    if (reservedSlugs.has(slug)) return new Response('Not found', { status: 404 });
  }

  const db = env.BLOG_DB;
  const rows = await db.prepare(
    "SELECT slug, title, category, published_at, summary, minutes FROM posts WHERE status='published'",
  ).all();
  if (!rows.results.length) return env.ASSETS.fetch(request);

  const online = rows.results.map((row) => ({
    ...row,
    categories: row.category ? [row.category] : [],
    excerpt: Array.from(row.summary).slice(0, 140).join(''),
  }));
  const posts = [...await staticCatalog(request, env), ...online].sort(byDate);

  let response;
  let hooks;
  if (isList || isHome) {
    response = await env.ASSETS.fetch(new Request(request.url));
    hooks = isHome
      ? [replace('[data-blog-recent]', (scope) => recentHTML(posts, scope))]
      : [replace('[data-blog-filters]', (scope) => filtersHTML(posts, scope)), replace('[data-blog-list]', (scope) => listHTML(posts, scope))];
  } else {
    const nav = replace('.post-nav', (scope) => neighborsHTML(posts, slug, scope));
    if (!online.some((post) => post.slug === slug)) {
      response = await env.ASSETS.fetch(new Request(request.url));
      if (!response.ok) return response;
      hooks = [nav];
    } else {
      const row = await db.prepare(`SELECT ${fields} FROM posts WHERE slug=? AND status='published'`).bind(slug).first();
      if (!row) return env.ASSETS.fetch(request);
      const post = publicPost(row);
      response = await asset(request, env, template);
      if (!response.ok) return response;
      const title = post.title + ' - Aaron Xu 的博客';
      const attribute = (name, value) => ({ element: (el) => el.setAttribute(name, value) });
      hooks = [
        replace('title', () => escape(title)),
        ['meta[property="og:title"]', attribute('content', title)],
        ['meta[property="og:description"]', attribute('content', post.excerpt)],
        ['meta[name="description"]', attribute('content', post.excerpt)],
        replace('.post-head h1', () => escape(post.title)),
        ['.post-meta time', { element(el) { el.setAttribute('datetime', post.published_at); el.setInnerContent(formatDate(new Date(post.published_at))); } }],
        ['.post-meta .cat', { element(el) { if (post.category) el.setInnerContent(post.category); else el.remove(); } }],
        replace('.post-meta .min', () => `约 ${post.minutes} 分钟`),
        replace('.post-head .tags', (s) => JSON.parse(post.tags).map((tag) => `<span class="chip"${s}>${escape(tag)}</span>`).join('')),
        replace('.post .prose', () => markdown(post.body)),
        nav,
      ];
    }
  }
  const rewritten = html(response, hooks);
  return request.method === 'HEAD' ? new Response(null, { status: rewritten.status, headers: rewritten.headers }) : rewritten;
}

export async function blogRequest(request, env, url) {
  const path = url.pathname;
  if (path === catalog) return new Response('Not found', { status: 404 });
  if (path.startsWith(apiPrefix)) {
    try { return await api(request, env, url); }
    catch (error) {
      if (error instanceof HTTPError) return json({ error: error.message }, error.status);
      console.error('Blog API:', error.message);
      return json({ error: '博客服务暂不可用，请稍后再试。' }, 503);
    }
  }

  if (path === '/blog/admin/') {
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    return new Response(response.body, { status: response.status, headers });
  }

  const single = /^\/blog\/([^/]+)$/.exec(path);
  if (single && single[1] === '__online-template') return new Response('Not found', { status: 404 });
  if (single && env.BLOG_DB && ['GET', 'HEAD'].includes(request.method) && !reservedSlugs.has(single[1])) {
    try {
      const row = await env.BLOG_DB.prepare("SELECT 1 AS found FROM posts WHERE slug=? AND status='published'").bind(decodeURIComponent(single[1])).first();
      if (row) return Response.redirect(new URL(path + '/' + url.search, url), 308);
    } catch {
      // Static articles remain available if blog storage is offline.
    }
  }

  try { return await publicPage(request, env, url, path); }
  catch (error) {
    console.error('Blog page:', error.message);
    return env.ASSETS.fetch(request);
  }
}
