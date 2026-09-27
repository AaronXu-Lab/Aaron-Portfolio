import type { FamilyModule } from "../showcase";
import { FlomoButton } from "./button";
import { AiSymbol } from "./float-button";
import "./empty-page-b.css";

const module: FamilyModule = {
  description: "空页面用表情或 AI 符号配合标题、说明与操作按钮，提示当前没有内容。",
  // Show Title / Show Button are Figma boolean properties (default on), not variant names.
  axes: {
    "4880:114052": [
      { name: "Type", values: ["Emoji", "Symbol"] },
      { name: "Show Title", values: ["False", "True"] },
      { name: "Show Button", values: ["False", "True"] },
    ],
  },
  defaults: { "4880:114052": { Type: "Emoji", "Show Title": "True", "Show Button": "True" } },
  renderers: {
    "4880:114052": ({ props, notify }) => (
      <div className="fm-empty-page-b">
        <div className="fm-empty-page-b-content">
          {props.Type === "Symbol" ? (
            <AiSymbol size={48} />
          ) : (
            <span className="fm-empty-page-b-emoji" role="img" aria-label="庆祝">
              🎉
            </span>
          )}
          <div className="fm-empty-page-b-texts">
            {props["Show Title"] !== "False" && <p className="fm-empty-page-b-title">Title</p>}
            <p className="fm-empty-page-b-text">Text</p>
          </div>
          {props["Show Button"] !== "False" && (
            <FlomoButton
              props={{ Type: "Icon+Text", Style: "Plain", Size: "Medium", State: "Normal" }}
              className="fm-empty-page-b-action"
              onClick={() => notify("点击了空页面操作")}
            />
          )}
        </div>
      </div>
    ),
  },
};
export default module;
