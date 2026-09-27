import type { ReactNode } from "react";
import type { Props } from "../data/showcase";

export type SpecimenProps = {
  /** Figma variant + boolean properties, keyed by clean property name ("Size", "Show Tail"). */
  props: Props;
  /** True in the playground (live hover/press/typing); false in the static variant matrix. */
  interactive: boolean;
};
export type Renderer = (specimen: SpecimenProps) => ReactNode;
/** Keyed by Figma node id of the component set (or standalone component). */
export type RendererMap = Record<string, Renderer>;

// Each specimens/<section>.tsx default-exports a RendererMap; new files register themselves.
const modules = import.meta.glob<{ default: RendererMap }>("./*.tsx", { eager: true });

export const renderers: RendererMap = Object.assign(
  {},
  ...Object.values(modules).map((module) => module.default ?? {}),
);
