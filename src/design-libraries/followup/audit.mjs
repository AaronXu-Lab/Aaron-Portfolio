import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname);

function jsonFiles(directory) {
  return readdirSync(join(root, directory))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) =>
      JSON.parse(readFileSync(join(root, directory, name), "utf8")),
    );
}

function unique(records) {
  return new Set(records.map((record) => record.id)).size;
}

const variableChunks = jsonFiles("data/variables");
const styleChunks = jsonFiles("data/styles");
const componentChunks = jsonFiles("data/components");
const componentSetChunks = jsonFiles("data/component-sets");
const references = JSON.parse(
  readFileSync(join(root, "data/references.json"), "utf8"),
);

const variables = variableChunks.flatMap((chunk) => chunk.variables);
const collections = new Map(
  variableChunks.map((chunk) => [chunk.collection.id, chunk.collection]),
);
const styles = styleChunks.flatMap((chunk) => chunk.styles);
const components = componentChunks.flatMap((chunk) => chunk.components);
const componentSets = componentSetChunks.flatMap(
  (chunk) => chunk.componentSets,
);

const styleCounts = Object.fromEntries(
  ["PAINT", "TEXT", "EFFECT", "GRID"].map((type) => [
    type,
    styleChunks
      .filter((chunk) => chunk.type === type)
      .reduce((count, chunk) => count + chunk.styles.length, 0),
  ]),
);
const pageCounts = Object.fromEntries(
  [...new Set(components.map((component) => component.pageName))]
    .sort()
    .map((pageName) => [
      pageName,
      components.filter((component) => component.pageName === pageName).length,
    ]),
);
const referenceFilesPresent = references.every((reference) => {
  const file = join(root, "../../../public", reference.src.replace(/^\//, ""));
  return existsSync(file) && statSync(file).size > 0;
});

const checks = [
  ["Variable collections", collections.size, 6],
  ["Variables", variables.length, 180],
  ["Unique variable IDs", unique(variables), 180],
  ["Paint styles", styleCounts.PAINT, 7],
  ["Text styles", styleCounts.TEXT, 17],
  ["Effect styles", styleCounts.EFFECT, 5],
  ["Grid styles", styleCounts.GRID, 3],
  ["All styles", styles.length, 32],
  ["Unique style IDs", unique(styles), 32],
  ["Local components", components.length, 1237],
  ["Unique component IDs", unique(components), 1237],
  ["Component Sets", componentSets.length, 199],
  ["Unique Component Set IDs", unique(componentSets), 199],
  ["Component-page definitions", pageCounts.Components, 450],
  ["Icon-page definitions", pageCounts.Icons, 442],
  ["Reference sections", references.length, 19],
  ["Reference PNGs present", Number(referenceFilesPresent), 1],
  [
    "Source pages represented",
    Object.keys(pageCounts).length,
    8,
  ],
];

let passed = 0;
for (const [label, actual, expected] of checks) {
  const ok = actual === expected;
  passed += Number(ok);
  console.log(
    `${ok ? "✓" : "✗"} ${label}: ${actual.toLocaleString()} / ${expected.toLocaleString()}`,
  );
}

console.log(`\n${passed}/${checks.length} source checks passing.`);
if (passed !== checks.length) {
  process.exitCode = 1;
}
