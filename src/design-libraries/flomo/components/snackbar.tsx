import { useEffect, useRef, useState } from "react";
import type { FamilyModule } from "../showcase";
import { Icon } from "./shared";
import { ICONS } from "./list";
import "./snackbar.css";

const TYPES = ["Text Only", "+Close", "+Text Button", "+Text Button&Close"];

/** Snackbar 106:11315 */
function Snackbar({
  type,
  text = "Text",
  interactive,
  onAction,
  onClose,
}: {
  type: string;
  text?: string;
  interactive: boolean;
  onAction?: () => void;
  onClose?: () => void;
}) {
  const hasButton = type.includes("Text Button");
  const hasClose = type.includes("Close");
  const Btn = interactive ? "button" : "span";
  const btn = (handler?: () => void) => (interactive ? { type: "button" as const, onClick: handler } : {});
  return (
    <div className="fm-snackbar" data-type={type}>
      <span className="fm-snackbar-text">{text}</span>
      {(hasButton || hasClose) && (
        <span className="fm-snackbar-buttons">
          {hasButton && (
            <Btn className="fm-snackbar-action fm-press" {...btn(onAction)}>
              Button
            </Btn>
          )}
          {hasClose && (
            <Btn className="fm-snackbar-close fm-press" aria-label={interactive ? "关闭" : undefined} {...btn(onClose)}>
              <Icon src={ICONS.xmark} />
            </Btn>
          )}
        </span>
      )}
    </div>
  );
}

/* Figma usage rules: one at a time (the new one replaces the old, on top); auto-dismiss within 3 s;
   touching anything else dismisses it at once; the close button only appears on snackbars that don't auto-dismiss. */
type Toast = { id: number; type: string; leaving: boolean };
const HIDE_AFTER = 3000;
const EXIT_MS = 200;

function SnackbarDemo({ notify }: { notify: (m: string) => void }) {
  const [type, setType] = useState(TYPES[2]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const layer = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dismiss = (id: number) => {
    setToasts((all) => all.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), EXIT_MS);
  };
  const show = () => {
    const id = ++seq.current;
    toasts.forEach((t) => !t.leaving && dismiss(t.id));
    setToasts((all) => [...all, { id, type, leaving: false }]);
    if (!type.includes("Close")) setTimeout(() => dismiss(id), HIDE_AFTER);
  };
  const live = toasts.find((t) => !t.leaving);
  useEffect(() => {
    if (!live || live.type.includes("Close")) return;
    const away = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!layer.current?.contains(target) && !trigger.current?.contains(target)) dismiss(live.id);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [live?.id]);
  return (
    <div className="fm-snackbar-demo">
      <div className="fm-snackbar-controls">
        <label>
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <button ref={trigger} type="button" className="fm-snackbar-trigger fm-press" onClick={show}>
          显示 Snackbar
        </button>
      </div>
      <div className="fm-snackbar-screen">
        <div className="fm-snackbar-layer" ref={layer} role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="fm-snackbar-slot" data-leaving={t.leaving}>
              <Snackbar
                type={t.type}
                interactive
                onAction={() => {
                  notify("点击了「Button」");
                  dismiss(t.id);
                }}
                onClose={() => dismiss(t.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const module: FamilyModule = {
  description: "Snackbar 在屏幕底部给出轻量反馈，可带一个文字操作；出现后 3 秒内自动消失，同一时间只显示一条。",
  defaults: { "106:11315": { Type: "Text Only" } },
  axes: { "106:11315": [{ name: "Type", values: TYPES }] },
  renderers: {
    "106:11315": ({ props, interactive, notify }) => (
      <Snackbar
        type={props.Type ?? "Text Only"}
        interactive={interactive}
        onAction={() => notify("点击了「Button」")}
        onClose={() => notify("点击了关闭")}
      />
    ),
  },
  demo: (notify) => <SnackbarDemo notify={notify} />,
};

export default module;
