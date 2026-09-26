import referenceData from "./references.json";

export type RGBAValue = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type VariableAlias = {
  type: "VARIABLE_ALIAS";
  id: string;
};

export type VariableValue = RGBAValue | VariableAlias | number | string | boolean;

export type VariableModeValue = {
  modeId: string;
  modeName: string;
  value: VariableValue;
  aliasTargetId: string | null;
  aliasTargetName: string | null;
  aliasTargetCollectionId: string | null;
  aliasTargetCollectionName: string | null;
};

export type FigmaVariable = {
  id: string;
  key: string;
  name: string;
  description: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  collectionId: string;
  collectionName: string;
  order: number;
  scopes: string[];
  codeSyntax: Record<string, string>;
  hiddenFromPublishing: boolean;
  values: VariableModeValue[];
};

export type VariableCollection = {
  id: string;
  key: string;
  name: string;
  defaultModeId: string;
  modes: Array<{ modeId: string; name: string }>;
  variableCount: number;
  hiddenFromPublishing: boolean;
  isExtension: boolean;
};

type VariableChunk = {
  collection: VariableCollection;
  variables: FigmaVariable[];
};

export type FigmaStyle = {
  id: string;
  key: string;
  name: string;
  description: string;
  order: number;
  remote: boolean;
  fontName?: { family: string; style: string };
  fontSize?: number;
  letterSpacing?: { unit: string; value: number };
  lineHeight?: { unit: string; value: number };
  textCase?: string;
  textDecoration?: string;
  paragraphIndent?: number;
  paragraphSpacing?: number;
  paints?: Array<Record<string, unknown>>;
  effects?: Array<Record<string, unknown>>;
  layoutGrids?: Array<Record<string, unknown>>;
  boundVariables?: Record<string, unknown>;
  styleType?: "PAINT" | "TEXT" | "EFFECT" | "GRID";
};

type StyleChunk = {
  type: "PAINT" | "TEXT" | "EFFECT" | "GRID";
  styles: FigmaStyle[];
};

export type NodeSummary = {
  id: string;
  name: string;
  type: string;
};

export type FigmaComponent = {
  id: string;
  key: string;
  name: string;
  description?: string;
  pageId: string;
  pageName: string;
  pageOrder: number;
  topLevel: NodeSummary | null;
  componentSet: NodeSummary | null;
  variantProperties: Record<string, string>;
  variantReadError?: boolean;
  width: number;
  height: number;
  absoluteX: number | null;
  absoluteY: number | null;
  isAsset: boolean;
};

type ComponentChunk = {
  components: FigmaComponent[];
};

export type ComponentPropertyDefinition = {
  type: string;
  defaultValue: unknown;
  variantOptions: string[] | null;
  preferredValues: unknown[] | null;
};

export type ComponentSetRecord = {
  id: string;
  key: string;
  name: string;
  description: string;
  pageId: string;
  pageName: string;
  pageOrder: number;
  topLevel: NodeSummary | null;
  componentPropertyDefinitions: Record<string, ComponentPropertyDefinition>;
  variantGroupProperties: Record<
    string,
    { values: string[]; preferredValues?: unknown[] }
  >;
  propertyReadError: boolean;
  componentIds: string[];
  variantCount: number;
  width: number;
  height: number;
  absoluteX: number | null;
  absoluteY: number | null;
};

type ComponentSetChunk = {
  componentSets: ComponentSetRecord[];
};

export type ReferenceSection = {
  id: string;
  slug: string;
  name: string;
  src: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
};

function loadGlob<T>(modules: Record<string, unknown>): T[] {
  return Object.entries(modules)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value as T);
}

const variableModules = import.meta.glob("./variables/*.json", {
  eager: true,
  import: "default",
});
const styleModules = import.meta.glob("./styles/*.json", {
  eager: true,
  import: "default",
});
const componentModules = import.meta.glob("./components/*.json", {
  eager: true,
  import: "default",
});
const componentSetModules = import.meta.glob("./component-sets/*.json", {
  eager: true,
  import: "default",
});

const variableChunks = loadGlob<VariableChunk>(variableModules);
const styleChunks = loadGlob<StyleChunk>(styleModules);
const componentChunks = loadGlob<ComponentChunk>(componentModules);
const componentSetChunks = loadGlob<ComponentSetChunk>(componentSetModules);

export const collections = Array.from(
  new Map(
    variableChunks.map((chunk) => [chunk.collection.id, chunk.collection]),
  ).values(),
).sort((left, right) => left.name.localeCompare(right.name));

export const variables = variableChunks
  .flatMap((chunk) => chunk.variables)
  .sort(
    (left, right) =>
      left.collectionName.localeCompare(right.collectionName) ||
      left.order - right.order,
  );

export const styles = styleChunks
  .flatMap((chunk) =>
    chunk.styles.map((style) => ({ ...style, styleType: chunk.type })),
  )
  .sort(
    (left, right) =>
      (left.styleType ?? "").localeCompare(right.styleType ?? "") ||
      left.order - right.order,
  );

export const components = componentChunks
  .flatMap((chunk) => chunk.components)
  .sort(
    (left, right) =>
      left.pageName.localeCompare(right.pageName) ||
      left.pageOrder - right.pageOrder,
  );

export const componentSets = componentSetChunks
  .flatMap((chunk) => chunk.componentSets)
  .sort(
    (left, right) =>
      left.pageName.localeCompare(right.pageName) ||
      left.pageOrder - right.pageOrder,
  );

export const references = referenceData as ReferenceSection[];

export const variableById = new Map(
  variables.map((variable) => [variable.id, variable]),
);

export const variableByName = new Map(
  variables.map((variable) => [
    `${variable.collectionName}/${variable.name}`,
    variable,
  ]),
);

function groupBy<T>(
  values: T[],
  selector: (value: T) => string,
): Record<string, T[]> {
  return values.reduce<Record<string, T[]>>((result, value) => {
    const key = selector(value);
    (result[key] ??= []).push(value);
    return result;
  }, {});
}

export const componentsByPage = groupBy(
  components,
  (component) => component.pageName,
);

export const componentSetsByPage = groupBy(
  componentSets,
  (componentSet) => componentSet.pageName,
);

export const componentsPageSets = componentSets.filter(
  (componentSet) => componentSet.pageName === "Components",
);

export const sourcePageOrder = [
  "Components",
  "Scenary",
  "Skeleton",
  "Icons",
  "Icons - drafts",
  "Icons_drafts",
  "_Drafts",
  "Logs",
];

export const inventory = {
  collections: collections.length,
  variables: variables.length,
  styles: styles.length,
  paintStyles: styles.filter((style) => style.styleType === "PAINT").length,
  textStyles: styles.filter((style) => style.styleType === "TEXT").length,
  effectStyles: styles.filter((style) => style.styleType === "EFFECT").length,
  gridStyles: styles.filter((style) => style.styleType === "GRID").length,
  components: components.length,
  componentSets: componentSets.length,
  standaloneComponents: components.filter((component) => !component.componentSet)
    .length,
  variantComponents: components.filter((component) => component.componentSet)
    .length,
  componentPageComponents: components.filter(
    (component) => component.pageName === "Components",
  ).length,
  componentPageSets: componentSets.filter(
    (componentSet) => componentSet.pageName === "Components",
  ).length,
  sections: references.length,
  variantReadErrors: components.filter(
    (component) => component.variantReadError,
  ).length,
  propertyReadErrors: componentSets.filter(
    (componentSet) => componentSet.propertyReadError,
  ).length,
};

function isAlias(value: VariableValue): value is VariableAlias {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "VARIABLE_ALIAS"
  );
}

export function resolveVariableValue(
  variable: FigmaVariable,
  modeName?: string,
  themeMode = "Default",
  visited = new Set<string>(),
): VariableValue | null {
  if (visited.has(variable.id)) return null;
  visited.add(variable.id);

  const selectedMode =
    variable.values.find((entry) => entry.modeName === modeName) ??
    variable.values[0];
  if (!selectedMode) return null;

  if (!isAlias(selectedMode.value)) return selectedMode.value;
  const target = variableById.get(selectedMode.value.id);
  if (!target) return null;

  const targetMode =
    target.collectionName === "Color/Theme"
      ? themeMode
      : target.values.some((entry) => entry.modeName === modeName)
        ? modeName
        : target.values[0]?.modeName;

  return resolveVariableValue(target, targetMode, themeMode, visited);
}

export function rgbaToCss(value: RGBAValue): string {
  const red = Math.round(value.r * 255);
  const green = Math.round(value.g * 255);
  const blue = Math.round(value.b * 255);
  if (value.a >= 0.999) return `rgb(${red} ${green} ${blue})`;
  return `rgb(${red} ${green} ${blue} / ${Math.round(value.a * 1000) / 1000})`;
}

export function rgbaToHex(value: RGBAValue): string {
  const part = (channel: number) =>
    Math.round(channel * 255).toString(16).padStart(2, "0").toUpperCase();
  const alpha = value.a < 0.999 ? part(value.a) : "";
  return `#${part(value.r)}${part(value.g)}${part(value.b)}${alpha}`;
}

export function valueToCss(value: VariableValue | null): string {
  if (value === null) return "-";
  if (typeof value === "object" && "r" in value) return rgbaToCss(value);
  if (typeof value === "object") return `var(${value.id})`;
  return String(value);
}

export function valueToLabel(value: VariableValue | null): string {
  if (value === null) return "Unresolved";
  if (typeof value === "object" && "r" in value) return rgbaToHex(value);
  if (typeof value === "object") return value.id;
  return String(value);
}

export function tokenValue(
  collectionName: string,
  tokenName: string,
  modeName?: string,
  themeMode = "Default",
): VariableValue | null {
  const token = variableByName.get(`${collectionName}/${tokenName}`);
  return token
    ? resolveVariableValue(token, modeName, themeMode)
    : null;
}

export function tokenCss(
  collectionName: string,
  tokenName: string,
  modeName?: string,
  themeMode = "Default",
): string {
  return valueToCss(
    tokenValue(collectionName, tokenName, modeName, themeMode),
  );
}

export function cssVariableName(name: string): string {
  return `--followup-${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

export function uniqueCount<T>(
  values: T[],
  selector: (value: T) => string,
): number {
  return new Set(values.map(selector)).size;
}
