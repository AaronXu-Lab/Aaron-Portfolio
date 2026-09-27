import { Fragment, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { FamilyModule, SpecimenProps } from "../showcase";
import "./segment.css";

/** Figma Segment 65:9702: 2–5 equal segments, selected slider slides between them. */
function Segment({ props, notify }: SpecimenProps) {
  const count = Number(props.Segments) || 2;
  const initial = Math.min(Number(props.Selected) || 1, count) - 1;
  const [selected, setSelected] = useState(initial);
  useEffect(() => setSelected(initial), [initial]);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (index: number, focus = false) => {
    setSelected(index);
    if (focus) buttons.current[index]?.focus();
    notify(`选中第 ${index + 1} 段`);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const next =
      step !== undefined ? (selected + step + count) % count : event.key === "Home" ? 0 : event.key === "End" ? count - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    select(next, true);
  };
  return (
    <div
      className="fm-segment"
      role="radiogroup"
      aria-label="Segment"
      style={{ "--fm-segment-count": count, "--fm-segment-index": selected } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      <span className="fm-segment-slider" aria-hidden="true" />
      {Array.from({ length: count }, (_, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span
              className="fm-segment-separator"
              aria-hidden="true"
              data-hidden={index === selected || index - 1 === selected || undefined}
            />
          )}
          <button
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={index === selected}
            tabIndex={index === selected ? 0 : -1}
            className="fm-segment-item fm-press"
            onClick={() => select(index)}
          >
            Label
          </button>
        </Fragment>
      ))}
    </div>
  );
}

const module: FamilyModule = {
  description: "分段控件在 2 至 5 个等宽选项之间切换，选中滑块随选择平滑移动，也可用方向键切换。",
  defaults: { "65:9702": { Segments: "2", Selected: "1" } },
  axes: {
    "65:9702": [
      { name: "Segments", values: ["2", "3", "4", "5"] },
      { name: "Selected", values: ["1", "2", "3", "4", "5"] },
    ],
  },
  renderers: { "65:9702": (specimen) => <Segment {...specimen} /> },
};
export default module;
