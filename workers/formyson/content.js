import MarkdownIt from "markdown-it";
export const BASE = "/formyson";
export const escape = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function safeURL(value, image = false) {
  if (typeof value !== "string" || /[\s\\\u0000-\u001f]/.test(value))
    return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return (image ? ["https:"] : ["https:", "http:", "mailto:"]).includes(
      new URL(value).protocol,
    );
  } catch {
    return false;
  }
}
const md = new MarkdownIt({ html: false, breaks: true, linkify: false });
md.validateLink = (url) => safeURL(url);
md.renderer.rules.image = (tokens, idx) => {
  const t = tokens[idx],
    src = t.attrGet("src");
  return safeURL(src, true)
    ? `<img src="${escape(src)}" alt="${escape(t.content)}" loading="lazy" decoding="async">`
    : escape(t.content);
};
const defaultLink =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet("rel", "noopener noreferrer");
  return defaultLink(tokens, idx, options, env, self);
};
export const markdown = (value) =>
  md.render(String(value || "").slice(0, 60000));
export function validateContent(input, kind) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid content.");
  const article = kind === "articles";
  const string = (key, max, required = false) => {
    const v = input[key] ?? "";
    if (typeof v !== "string" || v.length > max || (required && !v.trim()))
      throw new Error(`Check ${key} (maximum ${max} characters).`);
    return v.trim();
  };
  const d = {
    title: string("title", 200, true),
    slug: string("slug", 120, !article),
    category: string("category", 100),
    summary: string("summary", 600),
    body: string("body", 60000, article),
    author: string("author", 100),
    seoTitle: string("seoTitle", 200),
    seoDescription: string("seoDescription", 400),
    publishedAt: string("publishedAt", 10, !article),
  };
  if (article) {
    if (!d.slug) {
      const prefix = d.title.toLowerCase().normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "").slice(0, 80).replace(/-$/, "");
      d.slug = `${prefix || "article"}-${crypto.randomUUID()}`;
    }
    d.publishedAt ||= new Date().toISOString().slice(0, 10);
    d.category ||= "Studio Notes";
    d.author ||= "LOOMWORKS";
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug))
    throw new Error(
      "Use lowercase letters, numbers and hyphens for the URL slug.",
    );
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(d.publishedAt) ||
    !Number.isFinite(Date.parse(d.publishedAt)) ||
    new Date(d.publishedAt).toISOString().slice(0, 10) !== d.publishedAt
  )
    throw new Error("Enter a valid date.");
  if (!["draft", "published"].includes(input.status))
    throw new Error("Invalid status.");
  d.status = input.status;
  const img = (value) => {
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.url !== "string" ||
      value.url.length > 2000 ||
      !safeURL(value.url, true) ||
      typeof value.alt !== "string" ||
      value.alt.length > 300
    )
      throw new Error("Images need a valid HTTPS or local URL and alt text.");
    return { url: value.url, alt: value.alt.trim() };
  };
  d.cover = input.cover?.url
    ? img(article ? { ...input.cover, alt: input.cover.alt || d.title } : input.cover)
    : article ? { url: "/formyson/images/sewing.jpg", alt: "Placeholder: garment production" } : null;
  if (d.status === "published" && (!d.cover || !d.cover.alt))
    throw new Error("Add a cover image and its alt text before publishing.");
  if (!Array.isArray(input.gallery ?? []) || (input.gallery ?? []).length > 20)
    throw new Error("Use up to 20 gallery images.");
  d.gallery = (input.gallery ?? []).map(img);
  if (!Array.isArray(input.specs ?? []) || (input.specs ?? []).length > 40)
    throw new Error("Use up to 40 specifications.");
  d.specs = (input.specs ?? []).map((pair) => {
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      pair.some((v) => typeof v !== "string" || v.length > 300)
    )
      throw new Error("Invalid specification.");
    return pair.map((v) => v.trim());
  });
  if (
    !Array.isArray(input.tags ?? []) ||
    (input.tags ?? []).length > 20 ||
    (input.tags ?? []).some((t) => typeof t !== "string" || t.length > 80)
  )
    throw new Error("Use up to 20 tags.");
  d.tags = [
    ...new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean)),
  ];
  if (!d.summary)
    d.summary = md
      .parse(d.body, {})
      .flatMap((block) =>
        block.type === "inline"
          ? (block.children || [])
              .filter((t) => ["text", "code_inline"].includes(t.type))
              .map((t) => t.content)
          : [],
      )
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
  return d;
}
export function unpack(row) {
  return row
    ? {
        ...JSON.parse(row.data),
        id: row.id,
        kind: row.kind,
        slug: row.slug,
        title: row.title,
        category: row.category,
        status: row.status,
        publishedAt: row.published_at,
        updatedAt: row.updated_at,
        revision: row.revision,
      }
    : null;
}
export const image = (img, eager = false) =>
  img
    ? `<img src="${escape(img.url)}" alt="${escape(img.alt)}" loading="${eager ? "eager" : "lazy"}" decoding="async">`
    : "";
export function card(d, kind) {
  return `<a class="card" href="${BASE}/${kind}/${escape(d.slug)}/"><div class="card-media"><div class="ph"${kind === "articles" ? ' style="--ar:3/2"' : ""}>${image(d.cover)}</div></div><p class="card-meta">${escape(d.category)}${kind === "articles" ? ` · ${escape(d.publishedAt)}` : ""}</p><h3>${escape(d.title)}</h3><p class="muted">${escape(d.summary)}</p></a>`;
}
export function listing(kind, items, categories, category, page, total) {
  const product = kind === "products",
    title = product ? "Our collection" : "Journal";
  const link = (c, p = 1) =>
    `${BASE}/${kind}/?${new URLSearchParams({ ...(c ? { category: c } : {}), page: String(p) })}`;
  const chips = ["", ...categories]
    .map(
      (c) =>
        `<a class="chip" href="${escape(link(c))}" aria-current="${c === category}">${escape(c || "All")}</a>`,
    )
    .join("");
  const pages = Math.max(1, Math.ceil(total / 12));
  const pager =
    pages > 1
      ? `<nav class="pager" aria-label="Pagination">${page > 1 ? `<a href="${escape(link(category, page - 1))}" aria-label="Previous page">←</a>` : ""}<span>Page ${page} of ${pages}</span>${page < pages ? `<a href="${escape(link(category, page + 1))}" aria-label="Next page">→</a>` : ""}</nav>`
      : "";
  const [first, ...rest] = items;
  const featured =
    !product && first
      ? `<a class="card fm-featured" href="${BASE}/articles/${escape(first.slug)}/"><div class="ph" style="--ar:16/10">${image(first.cover, true)}</div><div class="fm-stack"><p class="card-meta">${escape(first.category)} · ${escape(first.publishedAt)}</p><h2>${escape(first.title)}</h2><p class="muted">${escape(first.summary)}</p><span class="link-arrow">Read article →</span></div></a>`
      : "";
  return `<section class="page-hero"><div class="wrap"><span class="eyebrow">${product ? "Products" : "Articles"}</span><h1>${title}</h1><p>${product ? "Core programs ready to customize with your fabric, fit and label. Low minimums, made in the U.S." : "Notes from the studio and the factory floor: industry news, craftsmanship and client stories."}</p></div></section><section class="section fm-list"><div class="wrap"><div class="chips">${chips}</div>${featured}<div class="grid grid-${product ? 4 : 3}">${(product ? items : rest).map((d) => card(d, kind)).join("")}</div>${!items.length ? '<p class="muted">No published content in this category yet.</p>' : ""}${pager}</div></section>`;
}
export function detail(d, related) {
  const product = d.kind === "products",
    kind = d.kind;
  const crumbs = `<nav class="crumbs" aria-label="Breadcrumb"><a href="${BASE}/${kind}/">${product ? "Products" : "Articles"}</a><span>/</span><span>${escape(d.category)}</span></nav>`;
  const content = product
    ? `<section class="section fm-list"><div class="wrap">${crumbs}<div class="fm-detail"><div class="fm-stack"><div class="ph">${image(d.cover, true)}</div><div class="fm-gallery">${d.gallery.map((img) => `<a href="${escape(img.url)}" target="_blank" rel="noopener" aria-label="${escape(img.alt || "View image")}"><div class="ph" style="--ar:1">${image(img)}</div></a>`).join("")}</div></div><div class="fm-stack"><p class="card-meta">${escape(d.category)}</p><h1>${escape(d.title)}</h1><p class="muted">${escape(d.summary)}</p><div class="prose">${markdown(d.body)}</div>${d.specs.length ? `<table class="fm-specs"><tbody>${d.specs.map(([k, v]) => `<tr><th>${escape(k)}</th><td>${escape(v)}</td></tr>`).join("")}</tbody></table>` : ""}<a class="btn btn-dark" href="${BASE}/contact/">Request a Quote</a></div></div></div></section><section class="section fm-wholesale"><div class="wrap"><h2>Contact us for wholesale inquiry</h2><p>Private label, bulk orders and custom development.</p><a class="link-arrow" href="${BASE}/contact/">Contact Us</a></div></section>`
    : `<article class="section fm-list"><div class="wrap fm-narrow fm-stack">${crumbs}<h1>${escape(d.title)}</h1><p class="card-meta">${escape(d.author)} · ${escape(d.publishedAt)}</p></div><div class="wrap fm-cover"><div class="ph" style="--ar:21/9">${image(d.cover, true)}</div></div><div class="wrap fm-narrow fm-stack"><p><strong>${escape(d.summary)}</strong></p><div class="prose">${markdown(d.body)}</div><div class="chips">${d.tags.map((t) => `<span class="chip">${escape(t)}</span>`).join("")}</div></article>`;
  return (
    content +
    (related.length
      ? `<section class="section"><div class="wrap"><div class="section-head"><h2>${product ? "Related products" : "More articles"}</h2></div><div class="grid grid-${product ? 4 : 3}">${related.map((r) => card(r, kind)).join("")}</div></div></section>`
      : "")
  );
}
