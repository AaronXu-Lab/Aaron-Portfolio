import { useEffect, useState } from "react";
import type { FamilyModule, SpecimenProps } from "../showcase";
import "./checkbox.css";

const next: Record<string, string> = { Checked: "Unchecked", Unchecked: "Checked", Indeterminate: "Checked" };
const aria = { Checked: true, Unchecked: false, Indeterminate: "mixed" } as const;

/** Figma Checkbox 126:8510: tap toggles; an indeterminate box becomes checked. */
function Checkbox({ props, notify }: SpecimenProps) {
  const initial = props.Status ?? "Checked";
  const [status, setStatus] = useState(initial);
  useEffect(() => setStatus(initial), [initial]);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={aria[status as keyof typeof aria]}
      aria-label="Checkbox"
      className="fm-checkbox fm-press"
      data-status={status}
      onClick={() => {
        setStatus(next[status]);
        notify(next[status] === "Checked" ? "已选中" : "已取消选中");
      }}
    >
      <span className="fm-checkbox-mark" />
    </button>
  );
}

const module: FamilyModule = {
  description: "复选框有选中、未选中与部分选中三种状态，点击切换，部分选中时点击变为选中。",
  renderers: { "126:8510": (specimen) => <Checkbox {...specimen} /> },
};
export default module;
