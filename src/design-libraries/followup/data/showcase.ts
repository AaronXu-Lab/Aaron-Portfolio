import {
  componentSets,
  components,
  references,
  styles,
  type ComponentSetRecord,
  type FigmaComponent,
} from "./catalog";
import iconManifest from "./icons.json";

// Visitor-facing view of the Figma source: public components only.
// Underscore-prefixed parts, _Drafts, Recycle and icon pages stay in the
// source catalog but never reach the showcase.

export type Props = Record<string, string>;
export type Axis = { name: string; values: string[]; kind: "variant" | "boolean" };
export type Variant = {
  id: string;
  props: Props;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type ShowcaseItem = {
  id: string;
  name: string;
  slug: string;
  axes: Axis[];
  defaults: Props;
  variants: Variant[];
  width: number;
  height: number;
};
export type ShowcaseSection = {
  slug: string;
  name: string;
  group: "Components" | "Scenary";
  items: ShowcaseItem[];
};
export type IconRecord = {
  name: string;
  variant: string | null;
  file: string;
  size: number;
  id: string;
};

// Building blocks that only exist as slots inside other components.
const atoms = new Set([
  "Cur",
  "Content",
  "Mask",
  "+ Background",
  "Page Divider",
  "Text Selector",
  "Menu chevron",
  "Menu check",
  "Menu icon",
  "Notification Wrapper",
]);

const slugify = (value: string) =>
  value
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const cleanName = (value: string) => value.replace(/[^\x20-\x7E]/g, "").trim();

const isPublic = (name: string) => !name.startsWith("_") && !atoms.has(name);

// Gallery order: size values ascend by rendered size; boolean slots follow the variant axes.
const sizeRank = ["mini", "small", "regular", "default", "medium", "large", "huge"];
const sizeOrder = (value: string) => {
  const rank = sizeRank.indexOf(value.toLowerCase());
  return rank >= 0 ? rank : Number.parseFloat(value) || 0;
};
const orderAxes = (axes: Axis[]) =>
  [...axes.filter((axis) => axis.kind === "variant"), ...axes.filter((axis) => axis.kind === "boolean")].map(
    (axis) => (/size/i.test(axis.name) ? { ...axis, values: [...axis.values].sort((x, y) => sizeOrder(x) - sizeOrder(y)) } : axis),
  );

function itemFromSet(set: ComponentSetRecord): ShowcaseItem {
  const ids = new Set(set.componentIds);
  const members = components
    .filter((component) => ids.has(component.id))
    .sort((a, b) => (a.absoluteY ?? 0) - (b.absoluteY ?? 0) || (a.absoluteX ?? 0) - (b.absoluteX ?? 0));
  const axes: Axis[] = [];
  const defaults: Props = {};
  for (const [key, definition] of Object.entries(set.componentPropertyDefinitions)) {
    const name = key.replace(/#[\d:]+$/, "");
    if (definition.type === "VARIANT") {
      axes.push({ name, values: definition.variantOptions ?? [], kind: "variant" });
      defaults[name] = String(definition.defaultValue);
    } else if (definition.type === "BOOLEAN") {
      axes.push({ name, values: ["False", "True"], kind: "boolean" });
      defaults[name] = definition.defaultValue ? "True" : "False";
    }
  }
  const booleanDefaults = Object.fromEntries(
    axes.filter((axis) => axis.kind === "boolean").map((axis) => [axis.name, defaults[axis.name]]),
  );
  return {
    id: set.id,
    name: set.name,
    slug: slugify(set.name),
    axes: orderAxes(axes),
    defaults,
    width: set.width,
    height: set.height,
    variants: members.map((member) => ({
      id: member.id,
      props: { ...booleanDefaults, ...member.variantProperties },
      x: (member.absoluteX ?? 0) - (set.absoluteX ?? 0),
      y: (member.absoluteY ?? 0) - (set.absoluteY ?? 0),
      width: member.width,
      height: member.height,
    })),
  };
}

function itemFromComponent(component: FigmaComponent): ShowcaseItem {
  return {
    id: component.id,
    name: component.name,
    slug: slugify(component.name),
    axes: [],
    defaults: {},
    width: component.width,
    height: component.height,
    variants: [{ id: component.id, props: {}, x: 0, y: 0, width: component.width, height: component.height }],
  };
}

function itemsFor(topLevelId: string): ShowcaseItem[] {
  const sets = componentSets
    .filter((set) => set.topLevel?.id === topLevelId && isPublic(set.name))
    .map(itemFromSet);
  const singles = components
    .filter(
      (component) =>
        !component.componentSet && component.topLevel?.id === topLevelId && isPublic(component.name),
    )
    .map(itemFromComponent);
  return [...sets, ...singles];
}

const componentSections: ShowcaseSection[] = references
  .map((reference) => ({
    slug: reference.slug,
    name: reference.name,
    group: "Components" as const,
    items: itemsFor(reference.id),
  }))
  .filter((section) => section.items.length > 0);

// Scenary keeps only its public component sets; page-sized fragments are compositions, not components.
const scenaryFrames = new Map<string, string>();
for (const set of componentSets) {
  if (set.pageName === "Scenary" && isPublic(set.name) && set.topLevel) {
    scenaryFrames.set(set.topLevel.id, cleanName(set.topLevel.name));
  }
}
const scenarySections: ShowcaseSection[] = [...scenaryFrames].map(([id, name]) => ({
  slug: `scenary-${slugify(name)}`,
  name,
  group: "Scenary" as const,
  items: componentSets
    .filter((set) => set.topLevel?.id === id && isPublic(set.name))
    .map(itemFromSet),
}));

export const sections: ShowcaseSection[] = [...componentSections, ...scenarySections];

export const icons = iconManifest as IconRecord[];

/** Styles without the underscore-prefixed drafts. */
export const publicStyles = styles.filter((style) => !style.name.startsWith("_"));

export const showcaseStats = {
  sections: sections.length,
  items: sections.reduce((total, section) => total + section.items.length, 0),
  variants: sections.reduce(
    (total, section) => total + section.items.reduce((sum, item) => sum + item.variants.length, 0),
    0,
  ),
  icons: new Set(icons.map((icon) => icon.name)).size,
};

export function sectionBySlug(slug: string | undefined) {
  return sections.find((section) => section.slug === slug) ?? sections[0];
}

/** Closest Figma variant for a prop combination; null when the source has no exact match. */
export function exactVariant(item: ShowcaseItem, props: Props): Variant | null {
  const variantAxes = item.axes.filter((axis) => axis.kind === "variant");
  return (
    item.variants.find((variant) =>
      variantAxes.every((axis) => variant.props[axis.name] === props[axis.name]),
    ) ?? null
  );
}
