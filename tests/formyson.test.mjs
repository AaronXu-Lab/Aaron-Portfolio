import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pbkdf2Sync } from "node:crypto";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { markdown, validateContent } from "../workers/formyson/content.js";
const password = "test-password-not-production",
  salt = "test-salt";
const valid = {
  title: "Integration product",
  slug: "integration-product",
  category: "Tests",
  status: "draft",
  publishedAt: "2026-09-26",
  body: "## A heading\n\nText **bold** and [link](https://example.com).",
  summary: "Summary",
  cover: { url: "/formyson/images/hero.jpg", alt: "Test cover" },
  gallery: [],
  specs: [["Fabric", "Cotton"]],
  tags: [],
  seoTitle: "Custom SEO title",
  seoDescription: "Custom SEO description",
};
test("Markdown and input validation reject active content and invalid URLs", () => {
  const html = markdown(
    "<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n![x](data:image/svg+xml,test)\n\n![safe](https://example.com/a.png)",
  );
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes('src="data:'));
  assert.ok(html.includes('loading="lazy"'));
  assert.throws(() =>
    validateContent(
      { ...valid, cover: { url: "javascript:alert(1)", alt: "x" } },
      "products",
    ),
  );
  assert.throws(() =>
    validateContent({ ...valid, slug: "../escape" }, "products"),
  );
  assert.throws(() =>
    validateContent({ ...valid, publishedAt: "2026-02-31" }, "products"),
  );
  assert.throws(() =>
    validateContent({ ...valid, status: "published", cover: null }, "products"),
  );
});
test("Worker integration: authentication, CRUD, publication, uploads, filtering and pagination", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "formyson-test-"));
  let mf;
  t.after(async () => {
    await mf?.dispose();
    await rm(dir, { recursive: true, force: true });
  });
  const bundle = join(dir, "worker.mjs");
  await build({
    entryPoints: ["workers/formyson/worker.js"],
    outfile: bundle,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
  });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: "formyson-test",
          modules: true,
          script: await readFile(bundle, "utf8"),
          compatibilityDate: "2026-09-07",
          d1Databases: ["DB"],
          r2Buckets: ["MEDIA"],
          bindings: {
            ADMIN_USERNAME: "admin",
            ADMIN_PASSWORD_SALT: salt,
            ADMIN_PASSWORD_HASH: pbkdf2Sync(
              password,
              salt,
              100000,
              32,
              "sha256",
            ).toString("hex"),
          },
          assets: {
            routerConfig: { has_user_worker: true },
            directory: join(process.cwd(), "dist"),
            binding: "ASSETS",
            run_worker_first: ["/formyson", "/formyson/*"],
          },
        },
      ],
    }),
  );
  const db = await mf.getD1Database("DB");
  const schema = await readFile(
    "workers/formyson/migrations/0001_schema.sql",
    "utf8",
  );
  for (const sql of schema.split(";").filter((s) => s.trim()))
    await db.prepare(sql).run();
  const origin = "https://example.com";
  let cookie = "";
  const request = async (path, method = "GET", body, headers = {}) =>
    mf.dispatchFetch(origin + path, {
      redirect: "manual",
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(method !== "GET"
          ? { Origin: origin, "Content-Type": "application/json" }
          : {}),
        ...headers,
      },
      ...(body !== undefined
        ? { body: typeof body === "string" ? body : JSON.stringify(body) }
        : {}),
    });
  const api = (path, ...args) => request("/formyson/api/" + path, ...args);
  {
    const r = await api("products");
    assert.equal(r.status, 401, await r.text());
  }
  assert.equal(
    (await api("login", "POST", { username: "admin", password: "wrong" }))
      .status,
    401,
  );
  assert.equal(
    (
      await api(
        "login",
        "POST",
        { username: "admin", password },
        { Origin: "https://evil.example" },
      )
    ).status,
    403,
  );
  const login = await api("login", "POST", { username: "admin", password });
  assert.equal(login.status, 200);
  assert.match(
    login.headers.get("set-cookie"),
    /HttpOnly; Secure; SameSite=Strict/,
  );
  cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal((await api("session")).status, 200);
  for (const title of ["Simple article", "只写标题和正文"]) {
    const minimal = await api("articles", "POST", { title, body: "A simple article body.", status: "published" });
    assert.equal(minimal.status, 201);
    let article = await minimal.json();
    assert.ok(article.slug);
    assert.equal(article.author, "LOOMWORKS");
    assert.equal(article.summary, "A simple article body.");
    assert.equal((await request(article.cover.url)).status, 200);
    const page = await request(`/formyson/articles/${article.slug}/`);
    assert.equal(page.status, 200);
    assert.ok((await page.text()).includes("A simple article body."));
    const originalSlug = article.slug;
    const updated = await api("articles/" + article.id, "PUT", { ...article, slug: "", title: title + " edited" });
    assert.equal(updated.status, 200);
    article = await updated.json();
    assert.equal(article.slug, originalSlug);
    assert.equal((await api("articles/" + article.id, "DELETE", { revision: article.revision })).status, 200);
  }
  for (const missing of [{ title: "No body", body: " " }, { title: " ", body: "No title" }]) {
    assert.equal((await api("articles", "POST", { ...missing, status: "published" })).status, 400);
  }
  const created = await api("products", "POST", valid);
  assert.equal(created.status, 201);
  let saved = await created.json();
  assert.equal(
    (await request("/formyson/products/integration-product/")).status,
    404,
  );
  assert.ok(
    !(await (await request("/formyson/products/")).text()).includes(
      valid.title,
    ),
  );
  assert.equal((await api("products", "POST", valid)).status, 409);
  assert.equal(
    (await api("products/" + saved.id, "PUT", { ...saved, revision: 0 }))
      .status,
    409,
  );
  let response = await api("products/" + saved.id, "PUT", {
    ...saved,
    status: "published",
  });
  assert.equal(response.status, 200);
  saved = await response.json();
  const detail = await request("/formyson/products/integration-product/");
  assert.equal(detail.status, 200);
  const html = await detail.text();
  assert.match(html, /<title>Custom SEO title \| LOOMWORKS<\/title>/);
  assert.ok(html.includes("Custom SEO description"));
  assert.ok(html.includes("<strong>bold</strong>"));
  assert.ok(html.includes('alt="Test cover"'));
  assert.equal(detail.headers.get("cache-control"), "no-store");
  assert.equal(detail.headers.get("etag"), null);
  assert.equal(
    (await request("/formyson/products/integration-product")).status,
    308,
  );
  assert.ok(
    (await (await request("/formyson/")).text()).includes("?category=Tests"),
  );
  assert.ok(
    (
      await (await request("/formyson/products/?category=Other")).text()
    ).includes("No published content"),
  );
  assert.equal((await (await api("products?q=Integration")).json()).total, 1);
  assert.equal((await (await api("products?q=absent")).json()).total, 0);
  assert.equal(
    (
      await api("preview", "POST", {
        body: "<img src=x onerror=alert(1)> **ok**",
      })
    ).status,
    200,
  );
  const svg = await api("upload", "POST", '<svg onload="alert(1)"></svg>', {
    "Content-Type": "image/svg+xml",
  });
  assert.equal(svg.status, 415);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE5cAAAAASUVORK5CYII=",
    "base64",
  );
  const uploaded = await mf.dispatchFetch(origin + "/formyson/api/upload", {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie, "Content-Type": "image/png" },
    body: png,
  });
  assert.equal(uploaded.status, 201);
  const media = await uploaded.json();
  const img = await request(media.url);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await img.arrayBuffer()), png);
  const tooLarge = await mf.dispatchFetch(origin + "/formyson/api/upload", {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie, "Content-Type": "image/png" },
    body: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  assert.equal(tooLarge.status, 413);
  for (let i = 0; i < 13; i++) {
    assert.equal(
      (
        await api("articles", "POST", {
          ...valid,
          slug: "article-" + i,
          title: "Article " + i,
          status: "published",
          author: "Team",
          tags: ["A"],
        })
      ).status,
      201,
    );
  }
  const list = await (await request("/formyson/articles/")).text();
  assert.ok(list.includes("Page 1 of 2"));
  assert.ok(
    (await (await request("/formyson/articles/?page=2")).text()).includes(
      "Page 2 of 2",
    ),
  );
  assert.ok(
    (await (await request("/formyson/articles/article-0/")).text()).includes(
      "Team",
    ),
  );
  assert.ok(
    (await (await request("/formyson/sitemap.xml")).text()).includes(
      "integration-product",
    ),
  );
  saved = await (
    await api("products/" + saved.id, "PUT", { ...saved, status: "draft" })
  ).json();
  assert.equal(
    (await request("/formyson/products/integration-product/")).status,
    404,
  );
  assert.ok(
    !(await (await request("/formyson/sitemap.xml")).text()).includes(
      "integration-product",
    ),
  );
  assert.equal(
    (await api("products/" + saved.id, "DELETE", { revision: saved.revision }))
      .status,
    200,
  );
  assert.equal((await api("products/" + saved.id)).status, 404);
  assert.equal(
    (await request("/formyson/admin/")).headers.get("x-frame-options"),
    "DENY",
  );
  assert.equal((await request("/")).status, 200);
  assert.equal((await api("logout", "POST", {})).status, 200);
  assert.equal((await api("session")).status, 401);
  // Persistent throttling applies even without a platform rate-limit binding.
  for (let i = 0; i < 10; i++)
    await api(
      "login",
      "POST",
      { username: "admin", password: "wrong" },
      { "CF-Connecting-IP": "203.0.113.10" },
    );
  assert.equal(
    (
      await api(
        "login",
        "POST",
        { username: "admin", password },
        { "CF-Connecting-IP": "203.0.113.10" },
      )
    ).status,
    429,
  );
});
