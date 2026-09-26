import {
  BASE,
  escape,
  safeURL,
  markdown,
  unpack,
  validateContent,
  card,
  listing,
  detail,
} from "./content.js";
const encoder = new TextEncoder();
const cookieName = "__Secure-formyson";
const maxJSON = 160000,
  maxImage = 5 * 1024 * 1024;
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
    fail(413, "File or content is too large.");
  const reader = request.body?.getReader();
  if (!reader) fail(400, "Request body required.");
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      fail(413, "File or content is too large.");
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
    fail(415, "Use JSON.");
  try {
    const value = JSON.parse(
      new TextDecoder().decode(await bytes(request, maxJSON)),
    );
    if (!value || typeof value !== "object" || Array.isArray(value))
      fail(400, "Use a JSON object.");
    return value;
  } catch (e) {
    if (e instanceof HTTPError) throw e;
    fail(400, "Invalid JSON.");
  }
}
function configured(env) {
  if (!env.DB || !env.MEDIA)
    fail(503, "Content storage has not been configured.");
}
async function session(request, env) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !env.ADMIN_PASSWORD_HASH)
    return null;
  const tokenHash = await hash(token),
    version = await hash(env.ADMIN_PASSWORD_HASH + env.ADMIN_USERNAME);
  const row = await env.DB.prepare(
    "SELECT token_hash FROM sessions WHERE token_hash=? AND expires_at>? AND credential_version=?",
  )
    .bind(tokenHash, Date.now(), version)
    .first();
  return row ? tokenHash : null;
}
const cookie = (value, maxAge) =>
  `${cookieName}=${value}; Path=/formyson/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
async function login(request, env) {
  if (
    !env.ADMIN_PASSWORD_HASH ||
    !env.ADMIN_PASSWORD_SALT ||
    !env.ADMIN_USERNAME
  )
    fail(503, "Administrator credentials have not been configured.");
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  if (env.LOGIN_LIMIT && !(await env.LOGIN_LIMIT.limit({ key: ip })).success)
    fail(429, "Too many login attempts. Try again in 15 minutes.");
  const now = Date.now(),
    key = await hash(ip);
  const count = await env.DB.prepare(
    "INSERT INTO login_attempts(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING attempts",
  )
    .bind(key, now + 900000, now, now)
    .first();
  if (count.attempts > 10)
    fail(429, "Too many login attempts. Try again in 15 minutes.");
  const input = await body(request);
  if (
    typeof input.username !== "string" ||
    typeof input.password !== "string" ||
    input.password.length > 256
  )
    fail(401, "Incorrect username or password.");
  const digest = await passwordHash(input.password, env.ADMIN_PASSWORD_SALT);
  if (
    !equal(digest, env.ADMIN_PASSWORD_HASH) ||
    input.username !== env.ADMIN_USERNAME
  )
    fail(401, "Incorrect username or password.");
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at<=?").bind(now),
    env.DB.prepare(
      "DELETE FROM login_attempts WHERE key=? OR expires_at<=?",
    ).bind(key, now),
    env.DB.prepare("INSERT INTO sessions VALUES(?,?,?)").bind(
      await hash(token),
      now + 43200000,
      await hash(env.ADMIN_PASSWORD_HASH + env.ADMIN_USERNAME),
    ),
  ]);
  return json({ username: env.ADMIN_USERNAME }, 200, {
    "Set-Cookie": cookie(token, 43200),
  });
}
export function imageType(b) {
  if (b.length >= 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return ["image/jpeg", "jpg"];
  if (
    b.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v)
  )
    return ["image/png", "png"];
  if (
    b.length >= 16 &&
    new TextDecoder().decode(b.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(b.slice(8, 12)) === "WEBP"
  )
    return ["image/webp", "webp"];
  return null;
}
async function api(request, env, url) {
  configured(env);
  const path = url.pathname.slice(`${BASE}/api/`.length).replace(/\/$/, "");
  const method = request.method;
  if (
    !["GET", "HEAD"].includes(method) &&
    request.headers.get("origin") !== url.origin
  )
    fail(403, "Request origin is not allowed.");
  if (path === "login" && method === "POST") return login(request, env);
  const token = await session(request, env);
  if (!token) fail(401, "Please sign in.");
  if (path === "session" && method === "GET")
    return json({ username: env.ADMIN_USERNAME });
  if (path === "logout" && method === "POST") {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?")
      .bind(token)
      .run();
    return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
  }
  if (path === "preview" && method === "POST") {
    const input = await body(request);
    if (typeof input.body !== "string" || input.body.length > 60000)
      fail(400, "Body must be at most 60,000 characters.");
    return json({ html: markdown(input.body) });
  }
  if (path === "export" && method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT * FROM content ORDER BY kind,slug",
    ).all();
    return json(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        content: results.map(unpack),
      },
      200,
      { "Content-Disposition": 'attachment; filename="formyson-content.json"' },
    );
  }
  if (path === "upload" && method === "POST") {
    const data = await bytes(request, maxImage),
      type = imageType(data);
    if (!type || request.headers.get("content-type") !== type[0])
      fail(415, "Upload a JPEG, PNG or WebP image (up to 5 MB).");
    const key = crypto.randomUUID() + "." + type[1];
    await env.MEDIA.put(key, data, {
      httpMetadata: {
        contentType: type[0],
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
    try {
      await env.DB.prepare("INSERT INTO media VALUES(?,?,?,?)")
        .bind(key, type[0], data.length, new Date().toISOString())
        .run();
    } catch (e) {
      await env.MEDIA.delete(key);
      throw e;
    }
    return json({ url: `${BASE}/media/${key}`, size: data.length }, 201);
  }
  const match = /^(products|articles)(?:\/([a-zA-Z0-9-]+))?$/.exec(path);
  if (!match) fail(404, "Not found.");
  const [, kind, id] = match;
  if (method === "GET" && !id) {
    const q = (url.searchParams.get("q") || "").slice(0, 200),
      page = Math.max(
        1,
        Math.min(
          100000,
          Number.parseInt(url.searchParams.get("page") || "1") || 1,
        ),
      );
    const params = [kind, `%${q}%`, `%${q}%`],
      where = "kind=? AND (title LIKE ? OR category LIKE ?)";
    const [rows, total] = await env.DB.batch([
      env.DB.prepare(
        `SELECT * FROM content WHERE ${where} ORDER BY updated_at DESC,id LIMIT 20 OFFSET ?`,
      ).bind(...params, (page - 1) * 20),
      env.DB.prepare(
        `SELECT count(*) AS total FROM content WHERE ${where}`,
      ).bind(...params),
    ]);
    return json({
      items: rows.results.map(unpack),
      total: total.results[0].total,
      page,
    });
  }
  const old = id
    ? await env.DB.prepare("SELECT * FROM content WHERE id=? AND kind=?")
        .bind(id, kind)
        .first()
    : null;
  if (id && !old) fail(404, "This item no longer exists.");
  if (method === "GET" && id) return json(unpack(old));
  if ((method === "POST" && !id) || (method === "PUT" && id)) {
    const input = await body(request);
    let data;
    try {
      data = validateContent(
        kind === "articles" && old && !input.slug?.trim()
          ? { ...input, slug: old.slug }
          : input,
        kind,
      );
    } catch (e) {
      fail(400, e.message);
    }
    if (old && input.revision !== old.revision)
      fail(409, "This item changed in another tab. Reload it before saving.");
    const unique = await env.DB.prepare(
      "SELECT id FROM content WHERE kind=? AND slug=?",
    )
      .bind(kind, data.slug)
      .first();
    if (unique && unique.id !== id)
      fail(409, "This URL slug is already in use.");
    const contentId = id || crypto.randomUUID(),
      now = new Date().toISOString();
    let result;
    try {
      result = old
        ? await env.DB.prepare(
            "UPDATE content SET slug=?,title=?,category=?,status=?,published_at=?,updated_at=?,data=?,revision=revision+1 WHERE id=? AND revision=?",
          )
            .bind(
              data.slug,
              data.title,
              data.category,
              data.status,
              data.publishedAt,
              now,
              JSON.stringify(data),
              id,
              input.revision,
            )
            .run()
        : await env.DB.prepare(
            "INSERT INTO content(id,kind,slug,title,category,status,published_at,updated_at,data) VALUES(?,?,?,?,?,?,?,?,?)",
          )
            .bind(
              contentId,
              kind,
              data.slug,
              data.title,
              data.category,
              data.status,
              data.publishedAt,
              now,
              JSON.stringify(data),
            )
            .run();
    } catch (e) {
      if (String(e).includes("UNIQUE"))
        fail(409, "This URL slug is already in use.");
      throw e;
    }
    if (!result.meta.changes)
      fail(409, "This item changed in another tab. Reload it before saving.");
    return json(
      unpack(
        await env.DB.prepare("SELECT * FROM content WHERE id=?")
          .bind(contentId)
          .first(),
      ),
      old ? 200 : 201,
    );
  }
  if (method === "DELETE" && id) {
    const input = await body(request);
    if (input.revision !== old.revision)
      fail(409, "This item changed. Reload it before deleting.");
    const r = await env.DB.prepare(
      "DELETE FROM content WHERE id=? AND revision=?",
    )
      .bind(id, input.revision)
      .run();
    if (!r.meta.changes)
      fail(409, "This item changed. Reload it before deleting.");
    return json({ ok: true });
  }
  fail(405, "Method not allowed.");
}
async function shell(
  request,
  env,
  {
    html,
    title,
    description,
    status = 200,
    home = false,
    categories = "",
    articles = "",
  },
) {
  const asset = await env.ASSETS.fetch(
    new Request(new URL(home ? `${BASE}/` : `${BASE}/products/`, request.url)),
  );
  if (!asset.ok) fail(503, "The website template is unavailable.");
  let rewriter = new HTMLRewriter()
    .on("head", {
      element(e) {
        e.append(`<link rel="stylesheet" href="${BASE}/content.css">`, {
          html: true,
        });
      },
    })
    .on('a[aria-current="page"]', {
      element(e) {
        e.removeAttribute("aria-current");
      },
    })
    .on(".nav a, .mobile-panel a", {
      element(e) {
        const href = e.getAttribute("href"),
          path = new URL(request.url).pathname;
        if (
          (href === `${BASE}/` && path === href) ||
          (href !== `${BASE}/` && path.startsWith(href))
        )
          e.setAttribute("aria-current", "page");
      },
    });
  if (html !== undefined)
    rewriter = rewriter.on("main", {
      element(e) {
        e.setInnerContent(html, { html: true });
      },
    });
  if (title)
    rewriter = rewriter.on("title", {
      element(e) {
        e.setInnerContent(`${title} | LOOMWORKS`);
      },
    });
  if (description !== undefined)
    rewriter = rewriter.on('meta[name="description"]', {
      element(e) {
        e.setAttribute("content", description);
      },
    });
  if (home)
    rewriter = rewriter
      .on('[data-cms="categories"]', {
        element(e) {
          e.setInnerContent(categories, { html: true });
        },
      })
      .on('[data-cms="articles"]', {
        element(e) {
          e.setInnerContent(articles, { html: true });
        },
      });
  const transformed = rewriter.transform(asset);
  const headers = new Headers(transformed.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Static-asset validators no longer describe the dynamically rendered document.
  headers.delete("etag");
  headers.delete("last-modified");
  headers.delete("content-length");
  headers.delete("content-encoding");
  return new Response(request.method === "HEAD" ? null : transformed.body, {
    status,
    headers,
  });
}
async function publicContent(request, env, url) {
  configured(env);
  const path = url.pathname;
  if (path === `${BASE}/`) {
    const [products, articles] = await env.DB.batch([
      env.DB.prepare(
        "WITH ranked AS (SELECT category,json_extract(data,'$.cover') AS cover,COUNT(*) OVER (PARTITION BY category) AS count,ROW_NUMBER() OVER (PARTITION BY category ORDER BY published_at DESC,slug) AS rank FROM content WHERE kind='products' AND status='published') SELECT category,cover,count FROM ranked WHERE rank=1 ORDER BY category",
      ),
      env.DB.prepare(
        "SELECT * FROM content WHERE kind='articles' AND status='published' ORDER BY published_at DESC,slug LIMIT 3",
      ),
    ]);
    const categories = products.results
      .map((row) => ({ ...row, item: { cover: JSON.parse(row.cover) } }))
      .map(
        ({ category, item, count }) =>
          `<a class="card" href="${BASE}/products/?category=${encodeURIComponent(category)}"><div class="card-media"><div class="ph" style="--ar:1"><img src="${escape(item.cover?.url || "")}" alt="${escape(item.cover?.alt || category)}" loading="lazy"></div></div><h3>${escape(category || "Products")}</h3><p class="card-meta">${count} styles</p></a>`,
      )
      .join("");
    return shell(request, env, {
      home: true,
      categories:
        categories || '<p class="muted">New products coming soon.</p>',
      articles:
        articles.results
          .map(unpack)
          .map((d) => card(d, "articles"))
          .join("") || '<p class="muted">New articles coming soon.</p>',
    });
  }
  const match = /^\/formyson\/(products|articles)\/(?:([a-z0-9-]+)\/)?$/.exec(
    path,
  );
  if (!match)
    return shell(request, env, {
      html: '<section class="section"><div class="wrap"><h1>Page not found</h1><p>This page is unavailable.</p></div></section>',
      title: "Page not found",
      status: 404,
    });
  const [, kind, slug] = match;
  if (slug) {
    const row = await env.DB.prepare(
      "SELECT * FROM content WHERE kind=? AND slug=? AND status='published'",
    )
      .bind(kind, slug)
      .first();
    if (!row)
      return shell(request, env, {
        html: `<section class="section"><div class="wrap"><h1>Page not found</h1><p>This item is unavailable.</p><a class="link-arrow" href="${BASE}/${kind}/">Browse ${kind}</a></div></section>`,
        title: "Page not found",
        status: 404,
      });
    const d = unpack(row),
      related = await env.DB.prepare(
        "SELECT * FROM content WHERE kind=? AND status='published' AND id<>? ORDER BY (category=?) DESC,published_at DESC,slug LIMIT 4",
      )
        .bind(kind, d.id, d.category)
        .all();
    return shell(request, env, {
      html: detail(d, related.results.map(unpack)),
      title: d.seoTitle || d.title,
      description: d.seoDescription || d.summary,
    });
  }
  const category = (url.searchParams.get("category") || "").slice(0, 100),
    page = Math.max(
      1,
      Math.min(
        100000,
        Number.parseInt(url.searchParams.get("page") || "1") || 1,
      ),
    );
  const where =
      "kind=? AND status='published'" + (category ? " AND category=?" : ""),
    params = category ? [kind, category] : [kind];
  const [rows, total, cats] = await env.DB.batch([
    env.DB.prepare(
      `SELECT * FROM content WHERE ${where} ORDER BY published_at DESC,slug LIMIT 12 OFFSET ?`,
    ).bind(...params, (page - 1) * 12),
    env.DB.prepare(`SELECT count(*) AS total FROM content WHERE ${where}`).bind(
      ...params,
    ),
    env.DB.prepare(
      "SELECT DISTINCT category FROM content WHERE kind=? AND status='published' AND category<>'' ORDER BY category",
    ).bind(kind),
  ]);
  return shell(request, env, {
    html: listing(
      kind,
      rows.results.map(unpack),
      cats.results.map((r) => r.category),
      category,
      page,
      total.results[0].total,
    ),
    title: kind === "products" ? "Products" : "Articles",
    description:
      kind === "products"
        ? "Browse our apparel programs: tees, hoodies, denim, outerwear, knitwear and activewear."
        : "Industry news, craftsmanship guides and case studies from our design and production teams.",
  });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url),
      path = url.pathname;
    try {
      if (path.startsWith(`${BASE}/api/`)) return await api(request, env, url);
      if (path.startsWith(`${BASE}/media/`)) {
        if (!["GET", "HEAD"].includes(request.method))
          fail(405, "Method not allowed.");
        const key = path.slice(`${BASE}/media/`.length);
        if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key))
          fail(404, "Image not found.");
        const object = await env.MEDIA.get(key);
        if (!object) fail(404, "Image not found.");
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("ETag", object.httpEtag);
        headers.set("X-Content-Type-Options", "nosniff");
        if (request.headers.get("if-none-match") === object.httpEtag)
          return new Response(null, { status: 304, headers });
        return new Response(request.method === "HEAD" ? null : object.body, {
          headers,
        });
      }
      if (
        path === `${BASE}/admin` ||
        path === BASE ||
        /^\/formyson\/(products|articles)(?:\/[a-z0-9-]+)?$/.test(path)
      )
        return Response.redirect(url.origin + path + "/" + url.search, 308);
      if (path.startsWith(`${BASE}/admin/`)) {
        const response = await env.ASSETS.fetch(request),
          headers = new Headers(response.headers);
        headers.set("Cache-Control", "no-store");
        headers.set("X-Robots-Tag", "noindex, nofollow");
        headers.set("X-Frame-Options", "DENY");
        headers.set(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: blob:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
        );
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
      if (path === `${BASE}/sitemap.xml`) {
        configured(env);
        const { results } = await env.DB.prepare(
          "SELECT kind,slug,updated_at FROM content WHERE status='published' ORDER BY kind,slug",
        ).all();
        const urls =
          ["", "products/", "articles/", "about/", "contact/"]
            .map(
              (p) =>
                `<url><loc>${escape(url.origin + BASE + "/" + p)}</loc></url>`,
            )
            .join("") +
          results
            .map(
              (r) =>
                `<url><loc>${escape(url.origin + BASE + "/" + r.kind + "/" + r.slug + "/")}</loc><lastmod>${escape(r.updated_at)}</lastmod></url>`,
            )
            .join("");
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
          {
            headers: {
              "Content-Type": "application/xml",
              "Cache-Control": "no-store",
            },
          },
        );
      }
      if (
        path === `${BASE}/` ||
        path.startsWith(`${BASE}/products/`) ||
        path.startsWith(`${BASE}/articles/`)
      ) {
        if (!["GET", "HEAD"].includes(request.method))
          fail(405, "Method not allowed.");
        return await publicContent(request, env, url);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof HTTPError)
        return json({ error: error.message }, error.status);
      console.error("Formyson request failed:", error.message);
      return json(
        { error: "The service is temporarily unavailable. Please try again." },
        503,
      );
    }
  },
};
