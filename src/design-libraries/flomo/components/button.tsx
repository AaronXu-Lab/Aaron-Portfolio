import type { FamilyModule, Props } from "../showcase";
import { Icon } from "./shared";
import "./button.css";

export const PLACEHOLDER = "/design-libraries/flomo/icons/dash-rectangle-16.svg";

/** Figma Button 24:10212. Also reused by other flomo specimens (e.g. Empty Page action). */
export function FlomoButton({
  props,
  text = "Text",
  className = "",
  onClick,
}: {
  props: Props;
  text?: string;
  className?: string;
  onClick?: () => void;
}) {
  const { Type: type = "Text", Style: style = "Fill", Size: size = "Medium", State: state = "Normal" } = props;
  const icon = type !== "Text" && <Icon src={PLACEHOLDER} size={size === "Large" ? 24 : 16} />;
  return (
    <button
      type="button"
      className={`fm-button fm-press ${className}`}
      data-style={style}
      data-size={size}
      disabled={state === "Disable"}
      aria-label={type === "Icon" ? "图标按钮" : undefined}
      onClick={onClick}
    >
      {type === "Icon+Text" && icon}
      {type !== "Icon" && <span className="fm-button-text">{text}</span>}
      {(type === "Text+Icon" || type === "Icon") && icon}
    </button>
  );
}

const module: FamilyModule = {
  description:
    "按钮分文字、图标与图文组合四种内容，Fill、Light、Plain 三种样式和小、中、大三档尺寸；Web 与客户端悬停时叠加一层 Hover 色。",
  defaults: { "24:10212": { Type: "Text", Style: "Fill", Size: "Medium", State: "Normal" } },
  axes: {
    "24:10212": [
      { name: "Type", values: ["Text", "Icon", "Text+Icon", "Icon+Text"] },
      { name: "Style", values: ["Fill", "Light", "Plain"] },
      { name: "Size", values: ["Small", "Medium", "Large"] },
      { name: "State", values: ["Normal", "Disable"] },
    ],
  },
  renderers: {
    "24:10212": ({ props, notify }) => (
      <FlomoButton props={props} onClick={() => notify(`点击了 ${props.Style} / ${props.Size} 按钮`)} />
    ),
  },
};
export default module;
