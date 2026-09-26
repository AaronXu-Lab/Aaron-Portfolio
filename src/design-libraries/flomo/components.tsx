import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import catalog from "./catalog.json";
import type { Config } from "./specs";

export function Placeholder() {
  return (
    <span className="fm-placeholder" aria-hidden="true">
      16
    </span>
  );
}
export function FlomoButton({
  config = {},
  children = "Text",
  onClick,
}: {
  config?: Config;
  children?: ReactNode;
  onClick?: () => void;
}) {
  const {
    Size = "Medium",
    Style = "Fill",
    Type = "Text",
    Disabled = "False",
  } = config;
  return (
    <button
      type="button"
      className="fm-button"
      data-size={Size}
      data-variant={Style}
      data-kind={Type}
      disabled={Disabled === "True"}
      aria-label={Type === "Icon" ? "Text" : undefined}
      onClick={onClick}
    >
      {(Type === "Icon" || Type === "Icon+Text") && <Placeholder />}
      {Type !== "Icon" && children}
      {Type === "Text+Icon" && <Placeholder />}
    </button>
  );
}
function Toggle() {
  const [checked, setChecked] = useState(true);
  return (
    <button
      className="fm-toggle"
      role="switch"
      aria-label="Text"
      aria-checked={checked}
      onClick={() => setChecked(!checked)}
    >
      <span />
    </button>
  );
}
function Checkbox({ state }: { state: string }) {
  const [value, setValue] = useState(state);
  useEffect(() => setValue(state), [state]);
  return (
    <button
      className="fm-checkbox"
      role="checkbox"
      aria-label="Text"
      aria-checked={value === "Indeterminate" ? "mixed" : value === "Checked"}
      onClick={() => setValue(value === "Checked" ? "Unchecked" : "Checked")}
    >
      {value === "Checked" ? "✓" : value === "Indeterminate" ? "−" : ""}
    </button>
  );
}
function Selection({ count, kind }: { count: number; kind: string }) {
  const [selection, setSelection] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const value = Math.min(selection, count - 1);
  return (
    <div
      className={`fm-${kind}`}
      role="group"
      aria-label={kind === "indicator" ? "分页" : "选项"}
    >
      {Array.from({ length: count }, (_, index) => (
        <button
          type="button"
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          aria-label={`Text ${index + 1}`}
          aria-pressed={value === index}
          onClick={() => setSelection(index)}
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
              return;
            e.preventDefault();
            const next =
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? count - 1
                  : (index + (e.key === "ArrowRight" ? 1 : -1) + count) % count;
            setSelection(next);
            refs.current[next]?.focus();
          }}
        >
          {kind === "bottom" && <Placeholder />}
          {kind !== "indicator" && `Text ${index + 1}`}
        </button>
      ))}
    </div>
  );
}
function Input({
  config,
  notify,
}: {
  config: Config;
  notify: (s: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="fm-input" data-size={config.Size}>
      {config.Leading === "Icon" && <Placeholder />}
      <input
        aria-label="Text"
        placeholder="Text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {config.Trailing === "Clear" && (
        <button
          aria-label="清空输入"
          disabled={!value}
          onClick={() => setValue("")}
        >
          ×
        </button>
      )}
      {config.Trailing === "Text" && (
        <button onClick={() => notify(value || "Text")}>Text</button>
      )}
    </div>
  );
}
function Menu({
  config,
  notify,
}: {
  config: Config;
  notify: (s: string) => void;
}) {
  return (
    <div className="fm-menu">
      {[1, 2, 3].map((n) => (
        <div className="fm-menu-row" key={n}>
          {config.Leading === "Icon" && <Placeholder />}
          {config.Leading === "Emoji" && <span>🍀</span>}
          <button onClick={() => notify(`已选择 Text ${n}`)}>Text {n}</button>
          {config.Trailing === "Icon" && <span aria-hidden="true">›</span>}
          {config.Trailing === "Detail" && <small>Detail</small>}
          {config.Trailing === "Badge" && <span className="fm-badge">3</span>}
          {config.Trailing === "Chip" && <span className="fm-label">Text</span>}
          {config.Trailing === "Toggle" && <Toggle />}
        </div>
      ))}
    </div>
  );
}
function Uploader({ config, demo }: { config: Config; demo: boolean }) {
  const [url, setUrl] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  const key =
    (
      {
        Done: "done",
        Todo: "todo",
        Uploading: "uploading",
        "Blur Number": "blurNumber",
      } as const
    )[config.State as "Done"] || "done";
  return (
    <div className="fm-upload">
      <img
        width="100"
        height="100"
        alt={url ? "所选图片预览" : `${config.State} 源库状态`}
        src={url || catalog.rasters[key]}
      />
      {demo && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file?.type.startsWith("image/"))
                setUrl(URL.createObjectURL(file));
              e.target.value = "";
            }}
          />
          <FlomoButton
            config={{ Style: "Light" }}
            onClick={() => input.current?.click()}
          >
            选择图片
          </FlomoButton>
          {url && (
            <button className="fm-text-button" onClick={() => setUrl("")}>
              移除
            </button>
          )}
        </>
      )}
    </div>
  );
}
function AudioBox({ expanded }: { expanded: boolean }) {
  const [open, setOpen] = useState(expanded);
  const [playing, setPlaying] = useState(false);
  useEffect(() => setOpen(expanded), [expanded]);
  return (
    <div className="fm-audio">
      <div>
        <button
          aria-label={playing ? "暂停状态演示" : "播放状态演示"}
          aria-pressed={playing}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
        <small>10:08</small>
        <button aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "收起 ∧" : "原文 ›"}
        </button>
      </div>
      {open && (
        <p>
          小车正穿行在落基山脉蜿蜒曲折的盘山公路上。每当车子即将行驶到无路的关头，路边都会出现一块交通指示牌：“前方转弯”。
        </p>
      )}
    </div>
  );
}
function DialogSurface({
  config,
  close,
}: {
  config: Config;
  close?: () => void;
}) {
  return (
    <div className="fm-dialog-card">
      <h3>Title</h3>
      <p>Description</p>
      <div className="fm-dialog-actions">
        {config.Count === "2" && <button onClick={close}>Cancel</button>}
        <button onClick={close}>Confirm</button>
      </div>
    </div>
  );
}
function SheetSurface({
  config,
  close,
}: {
  config: Config;
  close?: () => void;
}) {
  return (
    <div className="fm-sheet-card" data-type={config.Type}>
      <div className="fm-sheet-handle" />
      <header>
        <strong>Title</strong>
        {close && (
          <button aria-label="关闭面板" onClick={close}>
            ×
          </button>
        )}
      </header>
      <div className="fm-content-area">Content Area</div>
    </div>
  );
}
export function OverlayDemo({
  family,
  config,
  notify,
}: {
  family: string;
  config: Config;
  notify: (s: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const close = () => {
    ref.current?.close();
    notify("已关闭");
  };
  if (family === "menu")
    return (
      <details
        className="fm-menu-demo"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.currentTarget.open = false;
            e.currentTarget.querySelector("summary")?.focus();
          }
        }}
      >
        <summary className="fm-button" data-variant="Light">
          Text
        </summary>
        <Menu
          config={config}
          notify={(s) => {
            notify(s);
          }}
        />
      </details>
    );
  if (family === "snackbar") return <SnackbarDemo config={config} />;
  return (
    <>
      <FlomoButton onClick={() => ref.current?.showModal()}>
        打开{family === "sheet" ? "面板" : "弹窗"}
      </FlomoButton>
      <dialog
        className={`fm-overlay ${family === "sheet" ? "fm-sheet-overlay" : ""}`}
        data-type={config.Type}
        ref={ref}
        aria-label={family === "sheet" ? "面板演示" : "弹窗演示"}
        aria-describedby={id}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <span className="sr-only" id={id}>
          按 Escape 关闭。
        </span>
        {family === "sheet" ? (
          <SheetSurface config={config} close={close} />
        ) : (
          <>
            <DialogSurface config={config} close={close} />
            <button
              className="fm-overlay-close"
              aria-label="关闭弹窗"
              onClick={close}
            >
              ×
            </button>
          </>
        )}
      </dialog>
    </>
  );
}
function SnackbarDemo({ config }: { config: Config }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, [visible]);
  return (
    <>
      <FlomoButton onClick={() => setVisible(true)}>显示消息</FlomoButton>
      {visible && (
        <div className="fm-snackbar-float" role="status">
          <Snackbar config={config} close={() => setVisible(false)} />
        </div>
      )}
    </>
  );
}
function Snackbar({ config, close }: { config: Config; close: () => void }) {
  return (
    <div className="fm-snackbar">
      <span>Text</span>
      {config.Action === "True" && <button onClick={close}>Button</button>}
      {config.Close === "True" && (
        <button aria-label="关闭消息" onClick={close}>
          ×
        </button>
      )}
    </div>
  );
}
export function FlomoSpecimen({
  family,
  config,
  notify = () => {},
  demo = false,
}: {
  family: string;
  config: Config;
  notify?: (s: string) => void;
  demo?: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [selected, setSelected] = useState(-1);
  useEffect(() => {
    setDismissed(false);
  }, [family, config]);
  switch (family) {
    case "button":
      return (
        <FlomoButton config={config} onClick={() => notify("已点击 Text")} />
      );
    case "segment":
      return <Selection count={Number(config.Count)} kind="segment" />;
    case "label":
      return (
        <span className="fm-label">
          {config.Icon === "True" && <Placeholder />}Text
        </span>
      );
    case "input":
      return <Input config={config} notify={notify} />;
    case "snackbar":
      return dismissed ? (
        <button className="fm-text-button" onClick={() => setDismissed(false)}>
          重新显示
        </button>
      ) : (
        <Snackbar config={config} close={() => setDismissed(true)} />
      );
    case "checkbox":
      return <Checkbox state={config.State} />;
    case "list":
      return (
        <div className="fm-list">
          {[1, 2].map((n) => (
            <div className="fm-list-row" key={n}>
              {config.Icon === "True" && <Placeholder />}
              <button onClick={() => notify(`已选择 Title ${n}`)}>
                <span>Title {n}</span>
                {config.Detail === "True" && <small>Detail</small>}
              </button>
              {config.Trailing === "Chevron" && (
                <span aria-hidden="true">›</span>
              )}
              {config.Trailing === "Toggle" && <Toggle />}
            </div>
          ))}
        </div>
      );
    case "message":
    case "trash":
      return dismissed ? (
        <button className="fm-text-button" onClick={() => setDismissed(false)}>
          重新显示
        </button>
      ) : (
        <div className="fm-message" data-type={config.Type}>
          {config.Badge === "True" && (
            <span aria-hidden="true">
              {config.Type === "Alert"
                ? "!"
                : config.Type === "Fixed Tip"
                  ? "✓"
                  : "i"}
            </span>
          )}
          <div>Text{config.Description === "True" && <p>Description</p>}</div>
          {config.Cancelable === "True" && (
            <button aria-label="关闭提示" onClick={() => setDismissed(true)}>
              ×
            </button>
          )}
        </div>
      );
    case "page-indicator":
      return <Selection count={Number(config.Count)} kind="indicator" />;
    case "menu":
      return <Menu config={config} notify={notify} />;
    case "contribution":
      return (
        <div className="fm-contribution" data-size={config.Size}>
          {Array.from({ length: 84 }, (_, i) => (
            <button
              key={i}
              data-level={(Math.floor(i / 7) * 3 + (i % 7) * 2) % 4}
              aria-label={`第 ${i + 1} 天，等级 ${(Math.floor(i / 7) * 3 + (i % 7) * 2) % 4}`}
              aria-pressed={selected === i}
              onClick={() => {
                setSelected(selected === i ? -1 : i);
                notify(`第 ${i + 1} 天`);
              }}
            />
          ))}
        </div>
      );
    case "dialog":
      return (
        <DialogSurface config={config} close={() => notify("已点击操作")} />
      );
    case "navigation":
      return (
        <div className="fm-navigation" data-align={config.Align}>
          <button aria-label="返回" onClick={() => notify("返回操作")}>
            <span aria-hidden="true">‹</span>
          </button>
          <strong>
            {config.Title === "Logo"
              ? "flomo"
              : config.Title === "None"
                ? ""
                : "Title"}
          </strong>
          <button
            aria-label={config.Trailing === "Search" ? "搜索" : "Button 1"}
            onClick={() =>
              notify(
                config.Trailing === "Search" ? "搜索操作" : "已点击 Button 1",
              )
            }
          >
            {config.Trailing === "Search" ? "⌕" : "Button 1"}
          </button>
        </div>
      );
    case "image-uploader":
      return <Uploader config={config} demo={demo} />;
    case "audio":
      return <AudioBox expanded={config.Expanded === "True"} />;
    case "sheet":
      return <SheetSurface config={config} />;
    case "bottom-bar":
      return <Selection count={Number(config.Count)} kind="bottom" />;
    case "float-button":
      return (
        <button
          className="fm-float"
          data-shape={config.Shape}
          data-priority={config.Priority}
          aria-label="添加"
          onClick={() => notify("已点击添加")}
        >
          <Placeholder />
        </button>
      );
    case "empty-page-b":
      return (
        <div className="fm-empty">
          <span aria-hidden="true">{config.Type === "Emoji" ? "🍀" : "◇"}</span>
          <strong>Title</strong>
          <p>Description</p>
        </div>
      );
    default:
      return null;
  }
}
