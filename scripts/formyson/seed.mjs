// Regenerate only before the initial migration; production content lives in D1.
import { readFile, writeFile } from "node:fs/promises";
import { transform } from "esbuild";
const source = await readFile("src/pages/formyson/_data.ts", "utf8");
const { code } = await transform(source, { loader: "ts", format: "esm" });
const { products, articles } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
const productBody = `Built on our most-requested block, this style is cut and sewn in our Los Angeles facility. Every detail, from stitch density to rib recovery, is tuned by our in-house design team before bulk.

- **Custom options:** fabric, color, fit and trims
- **Branding:** woven labels, screen print, embroidery
- Fabric sourced from our certified mill partners`;
const articleBody = `For years, the default playbook for a growing label was simple: design locally, produce overseas, wait. That math is changing. Freight volatility, higher minimums and the need to react mid-season have pushed more brands to look closer to home.

## Speed is the new margin

When your design team and the sewing line share a building, a fit comment becomes a revised sample the same week.

- Sampling in 10 - 14 days
- Bulk in 4 - 6 weeks
- Reorders without re-quoting freight

![Fabric being cut in the pattern room](/formyson/images/cutting.jpg)

> "We launched two drops in the time it used to take us to approve one sample."

## What to ask a domestic partner

Ask who owns the pattern, how QC is documented, and what happens when a trim is late. The answers tell you more than a price sheet. [Talk to our team](/formyson/contact/) about your next program.`;
const quote = (v) => "'" + String(v).replaceAll("'", "''") + "'";
const now = "2026-09-26T00:00:00.000Z";
const rows = [
  ...products.map((p) => ({
    kind: "products",
    ...p,
    title: p.name,
    publishedAt: "2026-09-26",
    body: productBody,
  })),
  ...articles.map((a) => ({
    kind: "articles",
    ...a,
    summary: a.excerpt,
    publishedAt: new Date(a.date + " UTC").toISOString().slice(0, 10),
    body: articleBody,
  })),
];
const sql = rows
  .map((r) => {
    const data = {
      title: r.title,
      slug: r.slug,
      category: r.category,
      summary: r.summary,
      body: r.body,
      author: r.author || "",
      publishedAt: r.publishedAt,
      status: "published",
      cover: { url: `/formyson/images/${r.slug}.jpg`, alt: r.title },
      gallery: [],
      specs: r.specs || [],
      tags:
        r.kind === "articles"
          ? [r.category, "Manufacturing", "Made in USA"]
          : [],
      seoTitle: "",
      seoDescription: "",
    };
    return `INSERT INTO content (id,kind,slug,title,category,status,published_at,updated_at,data) VALUES (${["seed-" + r.slug, r.kind, r.slug, r.title, r.category, "published", r.publishedAt, now, JSON.stringify(data)].map(quote).join(",")});`;
  })
  .join("\n");
await writeFile(
  "workers/formyson/migrations/0002_seed.sql",
  "-- Initial demo content. Never re-import over edited content.\n" +
    sql +
    "\n",
);
console.log(`Prepared ${rows.length} initial content records.`);
