import { useState } from "react";
import type { FamilyModule } from "../showcase";
import { Icon } from "./shared";
import "./bottom-bar.css";

const PLACEHOLDER = "/design-libraries/flomo/icons/dash-rectangle-16.svg";

/** Bottom Bar 1177:62514 (Count). Figma draws no selected state; the pressed action is tinted with the theme colour. */
function BottomBar({ count, notify }: { count: number; notify: (message: string) => void }) {
  const [selected, setSelected] = useState(-1);
  return (
    <div className="fm-bottom-bar" data-count={count} role="group" aria-label="底部操作栏">
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          type="button"
          className="fm-bottom-bar-action fm-press"
          aria-pressed={selected === index}
          aria-label={`Text ${index + 1}`}
          onClick={() => {
            setSelected(index);
            notify(`选中了第 ${index + 1} 个操作`);
          }}
        >
          <Icon src={PLACEHOLDER} />
          <span className="fm-bottom-bar-text">Text</span>
        </button>
      ))}
    </div>
  );
}

const module: FamilyModule = {
  description: "底部操作栏悬浮在页面底部，以图标加文字的形式并排放置 1 到 3 个常用操作，点击即可切换。",
  renderers: {
    "1177:62514": ({ props, notify }) => <BottomBar key={props.Count} count={Number(props.Count ?? 1)} notify={notify} />,
  },
};
export default module;
