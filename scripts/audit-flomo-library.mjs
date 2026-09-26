import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
const catalog = JSON.parse(
  readFileSync(new URL("src/design-libraries/flomo/catalog.json", root)),
);
assert.equal(catalog.variables.length, 667);
assert.equal(catalog.styles.length, 39);
assert.equal(catalog.components.length, 381);
assert.equal(catalog.families.length, 23);
for (const records of [
  catalog.variables,
  catalog.styles,
  catalog.components,
  catalog.families,
]) {
  assert.equal(
    new Set(records.map((r) => r.id)).size,
    records.length,
    "Source IDs must remain unique",
  );
}
const icons = catalog.components.filter((c) => c.pageID === "119:9158");
assert.equal(icons.length, 42);
for (const icon of icons)
  assert.ok(catalog.icons[icon.id], `Missing SVG for ${icon.id}`);
for (const path of [
  ...Object.values(catalog.icons),
  ...Object.values(catalog.rasters),
]) {
  assert.ok(
    existsSync(new URL(`public${path}`, root)),
    `Missing asset ${path}`,
  );
}
for (const token of catalog.variables) {
  assert.ok(token.values.length, `Missing values for ${token.id}`);
  assert.equal(
    new Set(token.values.map((v) => v.mode)).size,
    token.values.length,
  );
}
assert.equal(
  catalog.families.filter(
    (f) => !catalog.components.some((c) => c.sectionID === f.nodeID),
  ).length,
  3,
);
console.log(
  "flomo source audit passed: 667 variables, 39 styles, 381 definitions, 23 families, 42 SVGs and 4 raster assets.",
);
