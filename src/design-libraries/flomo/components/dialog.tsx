import { useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { FamilyModule, Props } from "../showcase";
import { Icon } from "./shared";
import "./dialog.css";

const TITLE = "Dialog Title";
const TEXT = "It is recommended to use less than 3 lines of text to further elaborate on the content of the dialog.";
const XMARK = "/design-libraries/flomo/icons/xmark.svg";

type Platform = "android" | "web";
type Press = (label: string) => void;
const platformOf = (value: string | undefined): Platform => (value === "Web&Desktop" ? "web" : "android");
/** Boolean component properties (not variant axes): Figma default when the prop is absent. */
const flag = (value: string | undefined, fallback: boolean) => (value === undefined ? fallback : value === "True");

function Btn({ label, kind, onPress }: { label: string; kind: "primary" | "secondary" | "danger"; onPress: Press }) {
  return (
    <button type="button" className="fm-dialog-btn fm-press" data-kind={kind} onClick={() => onPress(label)}>
      <span className="fm-dialog-btn-label">{label}</span>
    </button>
  );
}

/** Dialog/Buttons 527:205854 */
function DialogButtons({
  platform,
  count,
  assist = false,
  labels = ["Button 1", "Button 2", "Button 3"],
  danger = false,
  onPress,
}: {
  platform: Platform;
  count: string;
  assist?: boolean;
  labels?: string[];
  danger?: boolean;
  onPress: Press;
}) {
  const [one, two, three] = labels;
  const primary = <Btn label={one} kind={danger ? "danger" : "primary"} onPress={onPress} />;
  if (platform === "android")
    return (
      <div className="fm-dialog-buttons" data-platform="android" data-count={count}>
        {count === "3" ? (
          <>
            {primary}
            <Btn label={two} kind="secondary" onPress={onPress} />
            <Btn label={three} kind="secondary" onPress={onPress} />
          </>
        ) : count === "2" ? (
          <>
            <Btn label={two} kind="secondary" onPress={onPress} />
            {primary}
          </>
        ) : (
          primary
        )}
      </div>
    );
  return (
    <div className="fm-dialog-buttons" data-platform="web" data-count={count}>
      <div className="fm-dialog-assist-slot">
        {assist && (
          <button type="button" className="fm-dialog-assist fm-press" onClick={() => onPress("Assist Button")}>
            Assist Button
          </button>
        )}
      </div>
      <div className="fm-dialog-button-group">
        {count === "3" && <Btn label={three} kind="secondary" onPress={onPress} />}
        {count !== "1" && <Btn label={two} kind="secondary" onPress={onPress} />}
        {primary}
      </div>
    </div>
  );
}

/** Dialog 527:207225 (Platform × Type; Show Description / Show InputText booleans). */
function DialogSurface({
  platform,
  type,
  description = true,
  input = false,
  title = TITLE,
  labels,
  danger,
  titleId,
  onPress,
  onClose,
}: {
  platform: Platform;
  type: "preset" | "custom";
  description?: boolean;
  input?: boolean;
  title?: string;
  labels?: string[];
  danger?: boolean;
  titleId?: string;
  onPress: Press;
  onClose: () => void;
}) {
  return (
    <div className="fm-dialog" data-platform={platform} data-type={type}>
      <div className="fm-dialog-body">
        <div className="fm-dialog-title" id={titleId}>
          {title}
        </div>
        {type === "custom" ? (
          <div className="fm-dialog-content">Content Area</div>
        ) : (
          <>
            {description && <p className="fm-dialog-desc">{TEXT}</p>}
            {input && (
              <label className="fm-dialog-field">
                <span className="sr-only">输入内容</span>
                <input className="fm-dialog-input" placeholder="Text" />
              </label>
            )}
          </>
        )}
      </div>
      <DialogButtons platform={platform} count="2" labels={labels} danger={danger} onPress={onPress} />
      {platform === "web" && (
        <button type="button" className="fm-dialog-close fm-press" aria-label="关闭" onClick={onClose}>
          <Icon src={XMARK} />
        </button>
      )}
    </div>
  );
}

/** iOS system alert: Figma draws no iOS dialog, so this follows the old SwiftUI showcase. */
function IOSAlert({
  title,
  description,
  input,
  labels,
  danger,
  titleId,
  onPress,
}: {
  title: string;
  description: boolean;
  input: boolean;
  labels: string[];
  danger: boolean;
  titleId: string;
  onPress: Press;
}) {
  return (
    <div className="fm-dialog-ios">
      <div className="fm-dialog-ios-text">
        <div className="fm-dialog-ios-title" id={titleId}>
          {title}
        </div>
        {description && <p className="fm-dialog-ios-message">{TEXT}</p>}
        {input && (
          <label className="fm-dialog-field fm-dialog-ios-field">
            <span className="sr-only">输入内容</span>
            <input className="fm-dialog-input" placeholder="Text" />
          </label>
        )}
      </div>
      <div className="fm-dialog-ios-actions">
        <button type="button" className="fm-dialog-ios-action fm-press" onClick={() => onPress(labels[1])}>
          {labels[1]}
        </button>
        <button
          type="button"
          className="fm-dialog-ios-action fm-press"
          data-kind={danger ? "danger" : "primary"}
          onClick={() => onPress(labels[0])}
        >
          {labels[0]}
        </button>
      </div>
    </div>
  );
}

const contents = {
  "Title+Description": { description: true, input: false },
  "Title Only": { description: false, input: false },
  "Title+InputText": { description: false, input: true },
  "Title+Description+InputText": { description: true, input: true },
  "Delete Confirm": { description: false, input: false },
} as const;
type Content = keyof typeof contents;

function DialogDemo({ notify }: { notify: (message: string) => void }) {
  const modal = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [platform, setPlatform] = useState("iOS");
  const [content, setContent] = useState<Content>("Title+Description");
  const danger = content === "Delete Confirm";
  const title = danger ? "Delete Confirm" : TITLE;
  const labels = danger ? ["Delete", "Cancel"] : platform === "iOS" ? ["Confirm", "Cancel"] : ["Button 1", "Button 2"];
  const close = (message: string) => {
    modal.current?.close();
    notify(message);
  };
  const press = (label: string) => close(`点击了「${label}」，弹窗已关闭`);
  const { description, input } = contents[content];
  let surface: ReactNode;
  if (platform === "iOS")
    surface = (
      <IOSAlert
        title={title}
        description={description}
        input={input}
        labels={labels}
        danger={danger}
        titleId="fm-dialog-demo-title"
        onPress={press}
      />
    );
  else
    surface = (
      <DialogSurface
        platform={platform === "Web" ? "web" : "android"}
        type="preset"
        description={description}
        input={input}
        title={title}
        labels={labels}
        danger={danger}
        titleId="fm-dialog-demo-title"
        onPress={press}
        onClose={() => close("已关闭弹窗")}
      />
    );
  return (
    <div className="fm-dialog-demo">
      <div className="fm-dialog-demo-controls">
        <label className="fm-dialog-demo-select">
          <span>内容</span>
          <select value={content} onChange={(e) => setContent(e.target.value as Content)}>
            {Object.keys(contents).map((key) => (
              <option key={key}>{key}</option>
            ))}
          </select>
        </label>
        <button
          ref={opener}
          type="button"
          className="fm-dialog-demo-trigger fm-press"
          onClick={() => {
            // Render the current platform's surface before showModal() picks the initial focus.
            flushSync(() => setPlatform(document.documentElement.dataset.flomoPlatform ?? "iOS"));
            modal.current?.showModal();
            notify("弹窗已打开：按 Esc、点击蒙版或任一按钮关闭。");
          }}
        >
          打开弹窗
        </button>
      </div>
      <p className="fm-dialog-demo-note">
        跟随顶部平台切换：Android 与 Web 使用 Figma 的对应变体；iOS 使用系统提示框样式（Figma 未绘制，沿用旧版 SwiftUI 展示）。
      </p>
      <dialog
        ref={modal}
        className="fm-dialog-modal"
        aria-labelledby="fm-dialog-demo-title"
        onCancel={() => notify("已按 Esc 关闭弹窗")}
        onClose={() => opener.current?.focus()}
        onClick={(e) => {
          if (e.target === e.currentTarget) close("已点击蒙版关闭弹窗");
        }}
      >
        {surface}
      </dialog>
    </div>
  );
}

const pressNotify = (notify: (message: string) => void) => (label: string) => notify(`点击了「${label}」`);

const module: FamilyModule = {
  description:
    "对话框在当前页面之上居中弹出，用于需要用户立即确认或填写的简短任务；Android 与 Web 各有一套版式；Figma 未绘制 iOS 弹窗，演示中 iOS 使用系统提示框样式。",
  // Show Description / Show InputText / Show Assist Button are Figma boolean properties, not variant names.
  axes: {
    "527:207225": [
      { name: "Platform", values: ["Android", "Web&Desktop"] },
      { name: "Type", values: ["Preset", "Custom"] },
      { name: "Show Description", values: ["False", "True"] },
      { name: "Show InputText", values: ["False", "True"] },
    ],
    "527:205854": [
      { name: "Platform", values: ["Android", "Web&Desktop"] },
      { name: "Count", values: ["1", "2", "3"] },
      { name: "Show Assist Button", values: ["False", "True"] },
    ],
  },
  defaults: {
    "527:207225": { Platform: "Android", Type: "Preset", "Show Description": "True", "Show InputText": "False" },
    "527:205854": { Platform: "Android", Count: "1", "Show Assist Button": "False" },
  },
  requires: {
    "527:207225": {
      "Show Description": { when: (p) => p.Type === "Preset", hint: "仅在 Type=Preset 时生效。" },
      "Show InputText": { when: (p) => p.Type === "Preset", hint: "仅在 Type=Preset 时生效。" },
    },
    "527:205854": {
      "Show Assist Button": { when: (p) => p.Platform === "Web&Desktop", hint: "仅在 Platform=Web&Desktop 时生效。" },
    },
  },
  renderers: {
    "527:207225": ({ props, notify }: { props: Props; notify: (message: string) => void }) => (
      <DialogSurface
        platform={platformOf(props.Platform)}
        type={props.Type === "Custom" ? "custom" : "preset"}
        description={flag(props["Show Description"], true)}
        input={flag(props["Show InputText"], false)}
        onPress={pressNotify(notify)}
        onClose={() => notify("点击了关闭按钮")}
      />
    ),
    "527:205854": ({ props, notify }) => (
      <div className="fm-dialog-buttons-frame">
        <DialogButtons
          platform={platformOf(props.Platform)}
          count={props.Count ?? "2"}
          assist={flag(props["Show Assist Button"], false)}
          onPress={pressNotify(notify)}
        />
      </div>
    ),
  },
  demo: (notify) => <DialogDemo notify={notify} />,
};
export default module;
