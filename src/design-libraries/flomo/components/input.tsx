import { useRef, useState } from "react";
import type { FamilyModule, SpecimenProps } from "../showcase";
import { PLACEHOLDER } from "./button";
import { Icon } from "./shared";
import "./input.css";

const XMARK = "/design-libraries/flomo/icons/xmark.svg";

/** Figma InputText 107:12764 with the InputText/Clear Button and Cursor atoms. */
function InputText({ props, notify }: SpecimenProps) {
  const { Size: size = "Default", Type: type = "Text", Trailing: trailing = "None" } = props;
  const [value, setValue] = useState("");
  const field = useRef<HTMLInputElement>(null);
  return (
    <div
      className="fm-input"
      data-size={size}
      data-type={type}
      data-trailing={trailing}
      onPointerDown={(event) => {
        // Tapping the field chrome focuses the text input, as a native search field does.
        if (!(event.target as Element).closest("button, input")) {
          event.preventDefault();
          field.current?.focus();
        }
      }}
    >
      <div className="fm-input-main">
        <div className="fm-input-content">
          {type === "Icon+Text" && <Icon src={PLACEHOLDER} />}
          {type === "Button+Text" && (
            <button type="button" className="fm-input-icon-button fm-press" aria-label="前置按钮" onClick={() => notify("点击了前置按钮")}>
              <Icon src={PLACEHOLDER} />
            </button>
          )}
          <input
            ref={field}
            className="fm-input-field"
            placeholder="Text"
            aria-label="InputText"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        {value && (
          <button
            type="button"
            className="fm-input-clear fm-press"
            aria-label="清除"
            onClick={() => {
              setValue("");
              field.current?.focus();
              notify("已清除输入");
            }}
          >
            <Icon src={XMARK} />
          </button>
        )}
      </div>
      {trailing === "Icon Buttons" && (
        <button type="button" className="fm-input-icon-button fm-press" aria-label="尾部按钮" onClick={() => notify("点击了尾部按钮")}>
          <Icon src={PLACEHOLDER} />
        </button>
      )}
      {trailing === "Text Button" && (
        <>
          <span className="fm-input-separator" aria-hidden="true" />
          <button type="button" className="fm-input-text-button fm-press" onClick={() => notify("点击了 Text Button")}>
            Text Button
          </button>
        </>
      )}
    </div>
  );
}

const module: FamilyModule = {
  description:
    "输入框有默认与大号两种尺寸，前部可放图标或图标按钮，尾部可放图标按钮或文字按钮；输入内容后出现清除按钮，光标使用主题色。",
  defaults: { "107:12764": { Size: "Default", Type: "Text", Trailing: "None" } },
  axes: {
    "107:12764": [
      { name: "Size", values: ["Default", "Large"] },
      { name: "Type", values: ["Text", "Icon+Text", "Button+Text"] },
      { name: "Trailing", values: ["None", "Icon Buttons", "Text Button"] },
    ],
  },
  renderers: { "107:12764": (specimen) => <InputText {...specimen} /> },
};
export default module;
