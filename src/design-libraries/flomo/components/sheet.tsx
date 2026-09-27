import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";
import type { FamilyModule } from "../showcase";
import { Icon } from "./shared";
import "./sheet.css";

type Type = "bottom" | "center-1" | "center-2";
const typeOf = (value: string | undefined): Type =>
  value === "Center-1 column" ? "center-1" : value === "Center-2 columns" ? "center-2" : "bottom";
const XMARK = "/design-libraries/flomo/icons/xmark.svg";

function Area() {
  return (
    <div className="fm-sheet-area">
      <div className="fm-sheet-content">Content Area</div>
    </div>
  );
}

/** Sheet 1165:37840 (Type; Bottom Space boolean). `onClose` adds the explicit close button Figma asks for. */
function SheetSurface({
  type,
  bottomSpace = false,
  titleId,
  onClose,
  onHeaderPointerDown,
}: {
  type: Type;
  bottomSpace?: boolean;
  titleId?: string;
  onClose?: () => void;
  onHeaderPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const close = onClose && (
    <button type="button" className="fm-sheet-close fm-press" aria-label="关闭面板" onClick={onClose}>
      <Icon src={XMARK} />
    </button>
  );
  return (
    <div className="fm-sheet" data-type={type}>
      <div className="fm-sheet-navi" onPointerDown={onHeaderPointerDown}>
        <div className="fm-sheet-bar">
          <div className="fm-sheet-leading">{type === "bottom" && close}</div>
          <div className="fm-sheet-title-part">
            <div className="fm-sheet-title" id={titleId}>
              Title
            </div>
          </div>
          {type !== "bottom" && close && <div className="fm-sheet-trailing">{close}</div>}
        </div>
      </div>
      {type === "center-2" ? (
        <div className="fm-sheet-columns">
          <Area />
          <Area />
        </div>
      ) : (
        <Area />
      )}
      {type === "bottom" && bottomSpace && <div className="fm-sheet-bottom-space" />}
    </div>
  );
}

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function SheetDemo({ notify }: { notify: (message: string) => void }) {
  const modal = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [type, setType] = useState<Type>("bottom");
  const [webType, setWebType] = useState<Type>("center-1");
  const drag = useRef<{ y: number; t: number; dy: number; v: number } | null>(null);

  const surface = () => modal.current?.querySelector<HTMLElement>(".fm-sheet");
  const open = () => {
    const platform = document.documentElement.dataset.flomoPlatform;
    flushSync(() => setType(platform === "Web" ? webType : "bottom"));
    const dialog = modal.current!;
    dialog.removeAttribute("data-shown");
    dialog.showModal();
    requestAnimationFrame(() => requestAnimationFrame(() => dialog.setAttribute("data-shown", "")));
    notify(
      platform === "Web"
        ? "面板已打开：按 Esc、点击蒙版或关闭按钮收起。"
        : "面板已打开：向下拖动标题栏、按 Esc、点击蒙版或关闭按钮收起。",
    );
  };
  const close = (message: string) => {
    const dialog = modal.current;
    if (!dialog?.open || dialog.hasAttribute("data-closing")) return;
    notify(message);
    const sheet = surface();
    if (sheet) sheet.style.transform = "";
    if (reduced()) return dialog.close();
    dialog.setAttribute("data-closing", "");
    dialog.removeAttribute("data-shown");
    const done = () => {
      dialog.removeAttribute("data-closing");
      dialog.close();
    };
    const timer = window.setTimeout(done, 450);
    sheet?.addEventListener(
      "transitionend",
      (event) => {
        if (event.target !== sheet || event.propertyName !== "transform") return;
        window.clearTimeout(timer);
        done();
      },
      { once: true },
    );
  };

  // Touch-style dismissal: drag the navigation bar down (bottom sheet only).
  const onHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (type !== "bottom" || (event.target as Element).closest("button")) return;
    const sheet = surface();
    if (!sheet) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { y: event.clientY, t: event.timeStamp, dy: 0, v: 0 };
    sheet.style.transition = "none";
    const header = event.currentTarget;
    const move = (e: PointerEvent) => {
      const state = drag.current;
      if (!state) return;
      const raw = e.clientY - state.y;
      // Rubber-band upwards, follow the finger downwards.
      const dy = raw < 0 ? -Math.sqrt(-raw) * 2 : raw;
      state.v = (dy - state.dy) / Math.max(1, e.timeStamp - state.t);
      state.t = e.timeStamp;
      state.dy = dy;
      sheet.style.transform = `translateY(${dy}px)`;
    };
    const up = () => {
      header.removeEventListener("pointermove", move);
      header.removeEventListener("pointerup", up);
      header.removeEventListener("pointercancel", up);
      const state = drag.current;
      drag.current = null;
      sheet.style.transition = "";
      if (state && (state.dy > sheet.offsetHeight * 0.3 || state.v > 0.5)) close("已向下拖动收起面板");
      else sheet.style.transform = "";
    };
    header.addEventListener("pointermove", move);
    header.addEventListener("pointerup", up);
    header.addEventListener("pointercancel", up);
  };

  return (
    <div className="fm-sheet-demo">
      <div className="fm-sheet-demo-controls">
        <label className="fm-sheet-demo-select">
          <span>Web 版式</span>
          <select value={webType} onChange={(e) => setWebType(e.target.value as Type)}>
            <option value="center-1">Center-1 column</option>
            <option value="center-2">Center-2 columns</option>
          </select>
        </label>
        <button ref={opener} type="button" className="fm-sheet-demo-trigger fm-press" onClick={open}>
          打开面板
        </button>
      </div>
      <p className="fm-sheet-demo-note">
        跟随顶部平台切换：iOS 与 Android 从底部弹出，可拖动标题栏向下收起；Web 居中弹出，尺寸受 Sheet 最大宽高变量约束。
      </p>
      <dialog
        ref={modal}
        className="fm-sheet-modal"
        data-type={type}
        aria-labelledby="fm-sheet-demo-title"
        onCancel={(e) => {
          e.preventDefault();
          close("已按 Esc 收起面板");
        }}
        onClose={() => opener.current?.focus()}
        onClick={(e) => {
          if (e.target === e.currentTarget) close("已点击蒙版收起面板");
        }}
      >
        <SheetSurface
          type={type}
          bottomSpace={type === "bottom"}
          titleId="fm-sheet-demo-title"
          onClose={() => close("已点击关闭按钮收起面板")}
          onHeaderPointerDown={onHeaderPointerDown}
        />
      </dialog>
    </div>
  );
}

const module: FamilyModule = {
  description:
    "面板在当前界面之上临时展示次要内容或操作：手机等小屏从底部弹出，平板与桌面等大屏居中显示，并始终保留显性的关闭按钮。",
  // Bottom Space is a Figma boolean property, not a variant name.
  axes: {
    "1165:37840": [
      { name: "Type", values: ["Bottom", "Center-1 column", "Center-2 columns"] },
      { name: "Bottom Space", values: ["False", "True"] },
    ],
  },
  defaults: { "1165:37840": { Type: "Bottom", "Bottom Space": "False" } },
  requires: {
    "1165:37840": { "Bottom Space": { when: (p) => p.Type === "Bottom", hint: "仅在 Type=Bottom 时生效。" } },
  },
  renderers: {
    "1165:37840": ({ props }) => {
      const type = typeOf(props.Type);
      return (
        <div className="fm-sheet-frame" data-type={type}>
          <SheetSurface type={type} bottomSpace={props["Bottom Space"] === "True"} />
        </div>
      );
    },
  },
  demo: (notify) => <SheetDemo notify={notify} />,
};
export default module;
