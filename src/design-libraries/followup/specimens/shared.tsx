import type { CSSProperties } from "react";
import "./shared.css";

const base = "/design-libraries/followup/icons/";

/**
 * Figma icon from public/design-libraries/followup/icons, tinted by `currentColor`.
 * `name` is the icon name without the "icon/" prefix ("chevron.down", "search");
 * `variant` is the Figma variant value ("16", "20", "medium") when the icon is a set.
 */
export function Icon({
  name,
  variant,
  size = 16,
  className = "",
  style,
}: {
  name: string;
  variant?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const file = `${base}${name}${variant ? `-${variant}` : ""}.svg`;
  return (
    <span
      aria-hidden="true"
      className={`fu-icon ${className}`}
      style={{ "--fu-icon": `url("${file}")`, width: size, height: size, ...style } as CSSProperties}
    />
  );
}

/** Gallery default icon: Figma's icon/icon.placeholder. */
export function Placeholder({ size = 16 }: { size?: 16 | 20 }) {
  return <Icon name="icon.placeholder" variant={String(size)} size={size} />;
}

/** "True"/"False" component property → boolean. */
export const on = (value: string | undefined) => value === "True";
