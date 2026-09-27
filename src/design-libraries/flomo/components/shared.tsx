import type { CSSProperties } from "react";
import catalog from "../catalog.json";
import "./shared.css";

const icons = catalog.icons as Record<string, string>;

/**
 * SVG icon tinted by `currentColor`. `src` is either a Figma icon node id from
 * catalog.icons ("106:11309") or a path under /design-libraries/flomo/.
 */
export function Icon({
  src,
  size = 16,
  className = "",
  style,
}: {
  src: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const url = icons[src] ?? src;
  return (
    <span
      aria-hidden="true"
      className={`fm-icon ${className}`}
      style={{ "--fm-icon": `url("${url}")`, width: size, height: size, ...style } as CSSProperties}
    />
  );
}

/** Gallery default icon: Figma's icon/dash.rectangle.16 placeholder. */
export function Placeholder({ size = 16 }: { size?: number }) {
  return <Icon src="/design-libraries/flomo/icons/dash-rectangle-16.svg" size={size} />;
}

export const on = (value: string | undefined) => value === "True";
