import type { FamilyModule } from "../showcase";
import { PLACEHOLDER } from "./button";
import { Icon } from "./shared";
import "./label.css";

const module: FamilyModule = {
  description: "标签用于快捷搜索、最近搜索等可点击的短词，分图标加文字与纯文字两种。",
  renderers: {
    "65:7750": ({ props, notify }) => (
      <button type="button" className="fm-label fm-press" onClick={() => notify("点击了标签")}>
        {props.Type === "Icon+Text" && <Icon src={PLACEHOLDER} />}
        <span>Text</span>
      </button>
    ),
  },
};
export default module;
