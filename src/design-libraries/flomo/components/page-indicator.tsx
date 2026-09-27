import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { FamilyModule, SpecimenProps } from "../showcase";
import "./page-indicator.css";

/** Figma Pagination Indicator 116:83567: 6px dots, the current page drawn in Text/Regular. */
function PageIndicator({ props, notify }: SpecimenProps) {
  const count = Number(props.Dots) || 2;
  const initial = Math.min(Number(props.Selected) || 1, count) - 1;
  const [page, setPage] = useState(initial);
  useEffect(() => setPage(initial), [initial]);
  const dots = useRef<(HTMLButtonElement | null)[]>([]);
  const go = (index: number, focus = false) => {
    setPage(index);
    if (focus) dots.current[index]?.focus();
    notify(`第 ${index + 1} / ${count} 页`);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    go(Math.min(Math.max(page + step, 0), count - 1), true);
  };
  return (
    <div className="fm-page-indicator" role="group" aria-label="页面指示器" onKeyDown={onKeyDown}>
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          ref={(node) => {
            dots.current[index] = node;
          }}
          type="button"
          className="fm-page-indicator-dot"
          aria-label={`第 ${index + 1} 页`}
          aria-current={index === page ? "page" : undefined}
          tabIndex={index === page ? 0 : -1}
          onClick={() => go(index)}
        />
      ))}
    </div>
  );
}

const module: FamilyModule = {
  description: "页面指示器用圆点标出当前页，点击圆点或用左右方向键翻页。",
  defaults: { "116:83567": { Dots: "2", Selected: "1" } },
  axes: {
    "116:83567": [
      { name: "Dots", values: ["2", "3", "4", "5"] },
      { name: "Selected", values: ["1", "2", "3", "4", "5"] },
    ],
  },
  renderers: { "116:83567": (specimen) => <PageIndicator {...specimen} /> },
};
export default module;
