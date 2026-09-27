import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { FamilyModule, SpecimenProps } from "../showcase";
import { PLACEHOLDER } from "./button";
import { Icon } from "./shared";
import "./float-button.css";

const ALIGN_RIGHT = "/design-libraries/flomo/icons/text-alignright.svg";

/** Figma AI Symbol 6444:34296. `fixedLight` pins the gradient to Light values (used inside Float Capsule). */
export function AiSymbol({ style = "Color", size = 24, fixedLight = false }: { style?: string; size?: number; fixedLight?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="fm-float-button-ai"
      data-style={style}
      data-fixed-light={fixedLight || undefined}
      style={{ "--fm-ai-size": `${size}px` } as CSSProperties}
    />
  );
}

function FloatButton({ props, notify }: SpecimenProps) {
  const secondary = props.Priority === "Secondary";
  return (
    <button
      type="button"
      className="fm-float-button fm-press"
      data-shape={props.Shape}
      data-priority={props.Priority}
      aria-label="悬浮按钮"
      onClick={() => notify(`点击了${secondary ? "次要" : "主要"}悬浮按钮`)}
    >
      <Icon src={PLACEHOLDER} size={24} />
    </button>
  );
}

function FloatWindowSurface() {
  return (
    <span className="fm-float-button-window-body fm-press">
      <Icon src={ALIGN_RIGHT} size={24} />
    </span>
  );
}

// Playground screen; the window docks to its left/right edge.
const SCREEN = { width: 280, height: 200 };
const SIZE = { Normal: { width: 42, height: 48 }, Dragging: { width: 56, height: 48 } };
const dockX = (state: "Normal" | "Dragging", side: string) => (side === "Left" ? 0 : SCREEN.width - SIZE[state].width);

/** Figma Float Window 879:50159: drag it with pointer events; on release it snaps to the nearest side. */
function FloatWindowPlayground({ props, notify }: SpecimenProps) {
  const initialState = props.State === "Dragging" ? "Dragging" : "Normal";
  const [side, setSide] = useState(props.Side === "Left" ? "Left" : "Right");
  const [state, setState] = useState<"Normal" | "Dragging">(initialState);
  const [pos, setPos] = useState({ x: dockX(initialState, side), y: (SCREEN.height - 48) / 2 });
  const [live, setLive] = useState(false);
  const drag = useRef<{ id: number; px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);

  const snap = (x: number, y: number) => {
    const next = x + SIZE.Dragging.width / 2 < SCREEN.width / 2 ? "Left" : "Right";
    setSide(next);
    setState("Normal");
    setPos({ x: dockX("Normal", next), y });
    notify(`已吸附到${next === "Left" ? "左" : "右"}侧`);
  };
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, px: event.clientX, py: event.clientY, x: dockX("Dragging", side), y: pos.y, moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.px;
    const dy = event.clientY - d.py;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    setLive(true);
    setState("Dragging");
    setPos({ x: clamp(d.x + dx, SCREEN.width - SIZE.Dragging.width), y: clamp(d.y + dy, SCREEN.height - SIZE.Dragging.height) });
  };
  const onPointerEnd = () => {
    const d = drag.current;
    drag.current = null;
    setLive(false);
    dragged.current = Boolean(d?.moved);
    if (d?.moved) snap(pos.x, pos.y);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const y = { ArrowUp: -12, ArrowDown: 12 }[event.key];
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      snap(event.key === "ArrowLeft" ? 0 : SCREEN.width, pos.y);
    } else if (y !== undefined) {
      event.preventDefault();
      setPos({ ...pos, y: clamp(pos.y + y, SCREEN.height - 48) });
    }
  };
  return (
    <div className="fm-float-button-screen" style={{ width: SCREEN.width, height: SCREEN.height }}>
      <button
        type="button"
        className="fm-float-button-window"
        data-state={state}
        data-side={side}
        data-live={live || undefined}
        aria-label="悬浮窗，可拖动；方向键移动"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClick={() => {
          // A drag ends with a click event; only a tap opens the window.
          if (!dragged.current) notify("打开悬浮窗");
          dragged.current = false;
        }}
        onKeyDown={onKeyDown}
      >
        <FloatWindowSurface />
      </button>
    </div>
  );
}

function FloatWindow(specimen: SpecimenProps) {
  const { props, interactive, notify } = specimen;
  // Key on the selected variant so the playground restarts from it.
  if (interactive) return <FloatWindowPlayground key={`${props.State}-${props.Side}`} {...specimen} />;
  return (
    <button
      type="button"
      className="fm-float-button-window"
      data-state={props.State}
      data-side={props.Side}
      aria-label="悬浮窗"
      onClick={() => notify("打开悬浮窗")}
    >
      <FloatWindowSurface />
    </button>
  );
}

const module: FamilyModule = {
  description:
    "悬浮按钮、悬浮窗与悬浮胶囊常驻页面之上：悬浮窗可拖动并吸附到最近的一侧，胶囊在悬停时加深阴影、按下时降低不透明度，AI 符号有彩色与单色两种。",
  defaults: { "879:50159": { State: "Dragging", Side: "Right" } },
  renderers: {
    "451:44250": (specimen) => <FloatButton {...specimen} />,
    "879:50159": (specimen) => <FloatWindow {...specimen} />,
    "4194:78372": ({ notify }) => (
      <button type="button" className="fm-float-button-capsule" onClick={() => notify("点击了悬浮胶囊")}>
        <AiSymbol fixedLight />
        <span className="fm-float-button-capsule-text">Text</span>
      </button>
    ),
    "6444:34296": ({ props }) => <AiSymbol style={props.Style} />,
  },
};
export default module;
