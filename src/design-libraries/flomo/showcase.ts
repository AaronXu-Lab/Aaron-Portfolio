import type { ReactNode } from "react";
import catalog from "./catalog.json";

// Visitor-facing view of the Figma component page. Underscore parts, wrappers,
// slot atoms and the legacy "Trash" section stay in the source catalog only.

export type Props = Record<string, string>;
export type Axis = { name: string; values: string[] };
export type Platform = "iOS" | "Android" | "Web";
/** Child axis that only takes effect when its parent premise holds. */
export type Requirement = { when: (props: Props) => boolean; hint: string };
export type Item = {
  id: string;
  name: string;
  axes: Axis[];
  defaults: Props;
  variants: Props[];
  /** Widest Figma variant, used to pick how many comparison columns fit. */
  width: number;
  requires: Record<string, Requirement>;
};
export type SpecimenProps = {
  props: Props;
  /** Default stage and demos are live; comparison blocks render the same component. */
  interactive: boolean;
  notify: (message: string) => void;
};
export type Renderer = (specimen: SpecimenProps) => ReactNode;
export type FamilyModule = {
  /** Keyed by Figma component-set id (or standalone component id). */
  renderers: Record<string, Renderer>;
  /** Figma default variant per item, when it isn't the first drawn variant. */
  defaults?: Record<string, Props>;
  /** Axis order/value overrides per item (e.g. sizes small → large). */
  axes?: Record<string, Axis[]>;
  /** Per item, axes that only apply under a premise (Gallery dims them otherwise). */
  requires?: Record<string, Record<string, Requirement>>;
  /** Family description shown under the page title. */
  description?: string;
  /** Optional live demo for behaviour that needs a trigger (overlays, toasts). */
  demo?: (notify: (message: string) => void) => ReactNode;
};

const hiddenFamilies = new Set(["trash"]);
const atoms = new Set([
  "InputText/Cursor",
  "InputText/Clear Button",
  "Segment/Slider/Selected",
  "Segment/Slider/False/Un-Selected",
  "Segment/Separator",
  "Pagination Indicator/Dot",
  "Pagination Indicator/Number",
  "NavigationBar-Breadcrumb/Unit",
  "NavigationBar-Breadcrumb/Separator",
  "Menu/Badge",
]);
const isPublic = (name: string) => !name.startsWith("_") && !/wrapper/i.test(name) && !atoms.has(name);

const modules = import.meta.glob<{ default: FamilyModule }>("./components/*.tsx", { eager: true });
const familyModules: Record<string, FamilyModule> = Object.fromEntries(
  Object.entries(modules).map(([path, module]) => [path.replace(/^.*\/|\.tsx$/g, ""), module.default]),
);

// Gallery order: size values ascend by rendered size.
const sizeRank = ["mini", "small", "regular", "default", "medium", "large", "huge"];
const sizeOrder = (value: string) => {
  const rank = sizeRank.indexOf(value.toLowerCase());
  return rank >= 0 ? rank : Number.parseFloat(value) || 0;
};
const orderAxes = (axes: Axis[]) =>
  axes.map((axis) =>
    /size/i.test(axis.name) ? { ...axis, values: [...axis.values].sort((x, y) => sizeOrder(x) - sizeOrder(y)) } : axis,
  );

function parseVariant(name: string): Props {
  return Object.fromEntries(
    name
      .split(",")
      .map((part) => part.split("=").map((piece) => piece.trim()))
      .filter((pair) => pair.length === 2),
  );
}

function buildItems(familyId: string, sectionId: string): Item[] {
  const module = familyModules[familyId];
  const records = catalog.components.filter((c) => c.sectionID === sectionId);
  const items = new Map<string, Item>();
  for (const record of records) {
    const setName = record.componentSetName ?? record.name;
    if (!isPublic(setName)) continue;
    const id = record.componentSetID ?? record.id;
    const item = items.get(id) ?? { id, name: setName, axes: [], defaults: {}, variants: [], width: 0, requires: {} };
    item.width = Math.max(item.width, record.width);
    if (record.componentSetID) {
      const props = parseVariant(record.name);
      item.variants.push(props);
      for (const [axisName, value] of Object.entries(props)) {
        const axis = item.axes.find((entry) => entry.name === axisName);
        if (!axis) item.axes.push({ name: axisName, values: [value] });
        else if (!axis.values.includes(value)) axis.values.push(value);
      }
    } else {
      item.variants.push({});
    }
    items.set(id, item);
  }
  return [...items.values()].map((item) => ({
    ...item,
    axes: module?.axes?.[item.id] ?? orderAxes(item.axes),
    defaults: module?.defaults?.[item.id] ?? item.variants[0] ?? {},
    requires: module?.requires?.[item.id] ?? {},
  }));
}

export const families = catalog.families
  .filter((family) => !hiddenFamilies.has(family.id))
  .map((family) => ({
    ...family,
    module: familyModules[family.id],
    items: buildItems(family.id, family.nodeID),
  }));
export type Family = (typeof families)[number];

export const isDrawn = (item: Item, props: Props) =>
  item.axes.length === 0 ||
  item.variants.some((variant) =>
    // Boolean component properties aren't part of variant names, so any value is drawn.
    item.axes.every((axis) => variant[axis.name] === undefined || variant[axis.name] === props[axis.name]),
  );

export const platforms: Platform[] = ["iOS", "Android", "Web"];
